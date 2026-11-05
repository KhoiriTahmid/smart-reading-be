import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ReadingHistoryModel } from './readingHistory.entity';
import { ReadingStatus } from './readingHistory.constants';
import {
  DEFAULT_READING_LANG,
  DEFAULT_READING_VOICE,
  READINGS_QUEUE,
  READING_LANGS,
  READING_VOICES,
  ReadingLang,
  ReadingVoice,
  TTS_MAX_CHARS,
} from './readingHistory.pipeline';
import { OcrTtsService } from '../ocr-tts/ocr-tts.service';

/**
 * concurrency 1 on purpose: the OCR/TTS service runs on 2 CPU / 4 GB
 * and handles one heavy job at a time.
 */
@Processor(READINGS_QUEUE, { concurrency: 1 })
export class ReadingHistoriesProcessor extends WorkerHost {
  private readonly logger = new Logger(ReadingHistoriesProcessor.name);

  constructor(
    @InjectModel(ReadingHistoryModel)
    private readonly readingHistoryModel: typeof ReadingHistoryModel,
    private readonly ocrClient: OcrTtsService,
  ) {
    super();
  }

  async process(
    job: Job<{ historyId: string; lang?: ReadingLang }>,
  ): Promise<void> {
    const { historyId, lang: jobLang } = job.data;

    const row = await this.readingHistoryModel.findByPk(historyId);
    if (!row) {
      throw new UnrecoverableError('Reading history not found (deleted?)');
    }
    if (row.status === ReadingStatus.COMPLETED && row.audioUrl) return;
    if (!row.sourceFileKey) {
      throw new UnrecoverableError('Reading history has no source file');
    }

    const storedLang = (row.metaDevice as { lang?: string } | null)?.lang;
    const rawLang = jobLang ?? storedLang;
    const lang: ReadingLang = READING_LANGS.includes(rawLang as ReadingLang)
      ? (rawLang as ReadingLang)
      : DEFAULT_READING_LANG;

    // ---- Stage 1: OCR (skipped on retry when text is already saved) ----
    if (!row.extractedText) {
      await row.update({ status: ReadingStatus.OCR_PROCESSING });

      const { text } = await this.ocrClient.ocr(row.sourceFileKey, lang);
      const clean = text.trim();
      if (!clean) {
        // Retrying the same blank image will not change anything
        throw new UnrecoverableError('No text found in the image');
      }

      await row.update({
        extractedText: clean,
        status: ReadingStatus.OCR_DONE,
      });
    }

    // ---- Stage 2: TTS ----
    let ttsText = row.extractedText!;
    let truncated = false;
    if (ttsText.length > TTS_MAX_CHARS) {
      ttsText = ttsText.slice(0, TTS_MAX_CHARS);
      truncated = true;
    }

    await row.update({ status: ReadingStatus.TTS_PROCESSING });

    const voice: ReadingVoice = READING_VOICES.includes(
      row.voice as ReadingVoice,
    )
      ? (row.voice as ReadingVoice)
      : DEFAULT_READING_VOICE;

    const { audio_key } = await this.ocrClient.tts({
      historyId,
      text: ttsText,
      voice,
      lang,
    });

    await row.update({
      audioUrl: audio_key, // stores the bucket KEY, presigned on read
      status: ReadingStatus.COMPLETED,
      errorMessage: null,
      ...(truncated
        ? {
            remark: `Audio generated from the first ${TTS_MAX_CHARS} characters`,
          }
        : {}),
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ historyId: string }> | undefined, err: Error) {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const permanent =
      err instanceof UnrecoverableError ||
      err.name === 'UnrecoverableError' ||
      job.attemptsMade >= maxAttempts;

    this.logger.warn(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}` +
        `${permanent ? ', final' : ''}): ${err.message}`,
    );

    if (!permanent) return; // BullMQ will retry, keep the current status

    await this.readingHistoryModel.update(
      {
        status: ReadingStatus.FAILED,
        errorMessage: err.message.slice(0, 1000),
      },
      { where: { historyId: job.data.historyId } },
    );
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Worker error: ${err.message}`);
  }
}
