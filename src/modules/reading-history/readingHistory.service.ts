import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FindAndCountOptions, Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { ReadingHistoryModel } from './readingHistory.entity';
import { UserModel } from '../users/users.entity';
import { StorageService } from '../storage/storage.service';
import { generatePaginationResponse } from 'src/helpers/parse';
import { BaseUserInfoRequest } from '../common/base.contract';
import {
  ALLOWED_IMAGE_TYPES,
  detectImageType,
  ReadingStatus,
} from './readingHistory.constants';
import {
  DeleteReadingHistoryRequest,
  FindAllReadingHistoryRequest,
  FindOneReadingHistoryRequest,
  UpdateReadingHistoryRequest,
} from './readingHistory.contract';
import { Queue } from 'bullmq';
import {
  DEFAULT_READING_LANG,
  DEFAULT_READING_VOICE,
  READING_JOB_NAME,
  READING_JOB_OPTIONS,
  READINGS_QUEUE,
  ReadingLang,
  ReadingVoice,
} from './readingHistory.pipeline';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class ReadingHistoriesService {
  private readonly logger = new Logger(ReadingHistoriesService.name);

  constructor(
    @InjectModel(ReadingHistoryModel)
    private readonly readingHistoryModel: typeof ReadingHistoryModel,
    private readonly storage: StorageService,
    @InjectQueue(READINGS_QUEUE) private readonly queue: Queue,
  ) {}

  async findAll(params: FindAllReadingHistoryRequest) {
    const { search, limit, offset, status = 'active', readingStatus } = params;
    let where: Record<string, any> = {};

    if (status === 'archive') where.deletedAt = { [Op.not]: null };
    if (readingStatus) where.status = readingStatus;
    if (search) {
      where = {
        ...where,
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { extractedText: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    const options: FindAndCountOptions = {
      where,
      limit,
      offset,
      include: [
        { model: UserModel, as: 'createdByUser', attributes: ['name'] },
      ],
      order: [['createdAt', 'DESC']],
      paranoid: status === 'active',
    };

    const { count, rows } =
      await this.readingHistoryModel.findAndCountAll(options);
    const results = await Promise.all(rows.map((v) => this.toResponse(v)));

    return {
      ...generatePaginationResponse({ count, query: params }),
      results,
    };
  }

  async findOne({ historyId }: FindOneReadingHistoryRequest) {
    const result = await this.readingHistoryModel.findOne({
      where: { historyId },
      include: [
        {
          model: UserModel,
          as: 'createdByUser',
          attributes: { exclude: ['passwordHash', 'refreshTokenHash'] },
        },
      ],
    });
    if (!result) throw new NotFoundException();
    return await this.toResponse(result);
  }

  // async create(
  //   file: Express.Multer.File,
  //   params: { name?: string } & BaseUserInfoRequest,
  // ) {
  //   if (!file) throw new BadRequestException('file is required');

  //   // Don't trust the client's mimetype: check the real file signature
  //   const detected = detectImageType(file.buffer);
  //   if (!detected || detected !== file.mimetype) {
  //     throw new BadRequestException('Only valid PNG or JPG images are allowed');
  //   }

  //   const historyId = uuidv4();
  //   const key = `uploads/${historyId}/source.${ALLOWED_IMAGE_TYPES[detected]}`;

  //   await this.storage.put(key, file.buffer, detected);

  //   try {
  //     const result = await this.readingHistoryModel.create({
  //       ...params,
  //       name: params.name ?? file.originalname,
  //       historyId,
  //       status: ReadingStatus.PENDING,
  //       sourceFileKey: key,
  //       sourceMimeType: detected,
  //     });

  //     // TODO (OCR step): enqueue the job here, e.g.
  //     // await this.readingsQueue.add('process', { historyId }, { jobId: historyId, ... });

  //     return await this.toResponse(result);
  //   } catch (e) {
  //     await this.storage.delete(key).catch(() => undefined);
  //     throw e;
  //   }
  // }

  async create(
    file: Express.Multer.File,
    params: {
      name?: string;
      voice?: ReadingVoice;
      lang?: ReadingLang;
    } & BaseUserInfoRequest,
  ) {
    if (!file) throw new BadRequestException('file is required');

    const detected = detectImageType(file.buffer);
    if (!detected || detected !== file.mimetype) {
      throw new BadRequestException('Only valid PNG or JPG images are allowed');
    }

    const historyId = uuidv4();
    const key = `uploads/${historyId}/source.${ALLOWED_IMAGE_TYPES[detected]}`;
    const lang = params.lang ?? DEFAULT_READING_LANG;

    await this.storage.put(key, file.buffer, detected);

    let row: ReadingHistoryModel;
    try {
      row = await this.readingHistoryModel.create({
        ...params,
        name: params.name ?? file.originalname,
        voice: params.voice ?? DEFAULT_READING_VOICE,
        metaDevice: { lang },
        historyId,
        status: ReadingStatus.PENDING,
        sourceFileKey: key,
        sourceMimeType: detected,
      });
    } catch (e) {
      // DB insert failed: don't leave an orphan file in the bucket
      await this.storage.delete(key).catch(() => undefined);
      throw e;
    }

    try {
      await this.enqueue(historyId, lang);
    } catch (e) {
      this.logger.error(
        `Failed to enqueue ${historyId}: ${(e as Error).message}`,
      );
      await row.update({
        status: ReadingStatus.FAILED,
        errorMessage: 'Failed to enqueue job',
      });
      throw new ServiceUnavailableException(
        'Could not queue the reading job. It can be retried later.',
      );
    }

    return await this.toResponse(row);
  }

  private async enqueue(historyId: string, lang?: ReadingLang) {
    // jobId = historyId: the same reading can never be queued twice
    await this.queue.add(
      READING_JOB_NAME,
      { historyId, ...(lang ? { lang } : {}) },
      { ...READING_JOB_OPTIONS, jobId: historyId },
    );
  }

  /** Re-run a FAILED reading. OCR is skipped if the text was already saved. */
  async retry({ historyId }: FindOneReadingHistoryRequest) {
    const row = await this.readingHistoryModel.findByPk(historyId);
    if (!row) throw new NotFoundException();
    if (row.status !== ReadingStatus.FAILED) {
      throw new BadRequestException('Only failed readings can be retried');
    }

    // A finished-but-failed job with the same id would block queue.add()
    const existing = await this.queue.getJob(historyId);
    if (existing) {
      try {
        await existing.remove();
      } catch {
        throw new ConflictException(
          'The job is still active, try again shortly',
        );
      }
    }

    await row.update({ status: ReadingStatus.PENDING, errorMessage: null });
    await this.enqueue(historyId);
    return await this.toResponse(row);
  }

  async update({
    historyId,
    ...params
  }: UpdateReadingHistoryRequest & { historyId: string }) {
    const result = await this.readingHistoryModel.update(params, {
      where: { historyId },
    });
    return result;
  }

  async restore(historyId: string) {
    await this.readingHistoryModel.restore({ where: { historyId } });
    return 'success';
  }

  async delete({
    historyId,
    isForceDelete,
  }: DeleteReadingHistoryRequest & { historyId: string }) {
    if (isForceDelete) {
      const row = await this.readingHistoryModel.findOne({
        where: { historyId },
        paranoid: false,
      });
      if (row) {
        const keys = [row.sourceFileKey, row.audioUrl].filter(
          (k): k is string => !!k,
        );
        await Promise.all(
          keys.map((k) =>
            this.storage
              .delete(k)
              .catch((err) =>
                this.logger.warn(`Failed to delete ${k}: ${err.message}`),
              ),
          ),
        );
      }
    }

    await this.readingHistoryModel.destroy({
      where: { historyId },
      force: isForceDelete,
    });
    return 'success';
  }

  /** Swap bucket keys for fresh presigned URLs and hide internals. */
  private async toResponse(row: ReadingHistoryModel) {
    const { sourceFileKey, ...data } = row.get({ plain: true });

    const [imageUrl, audioUrl] = await Promise.all([
      sourceFileKey ? this.storage.getPresignedUrl(sourceFileKey) : null,
      data.audioUrl ? this.storage.getPresignedUrl(data.audioUrl) : null,
    ]);

    return { ...data, imageUrl, audioUrl };
  }
}
