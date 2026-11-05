import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ReadingHistoriesService } from './readingHistory.service';
import {
  CreateReadingHistoryRequest,
  DeleteReadingHistoryRequest,
  FindAllReadingHistoryRequest,
  FindOneReadingHistoryRequest,
  UpdateReadingHistoryRequest,
} from './readingHistory.contract';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from './readingHistory.constants';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionGuard } from 'src/guards/permission.guard';
import { Logger } from 'nestjs-pino';

@ApiTags('reading-histories')
@ApiBearerAuth()
@Controller('reading-histories')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class ReadingHistoriesController {
  constructor(
    private readonly service: ReadingHistoriesService,
    private readonly logger: Logger,
  ) {}

  @Get()
  @Permissions([
    'READING_HISTORY.LIST',
    'READING_HISTORY.DETAIL',
    'READING_HISTORY.CREATE',
    'READING_HISTORY.UPDATE',
    'READING_HISTORY.DELETE',
  ])
  async findAll(@Query() query: FindAllReadingHistoryRequest) {
    return await this.service.findAll(query);
  }

  @Get(':historyId')
  @Permissions([
    'READING_HISTORY.DETAIL',
    'READING_HISTORY.LIST',
    'READING_HISTORY.CREATE',
    'OCR.CREATE',
    'OCR.DETAIL',
    'OCR.LIST',
    'TTS.CREATE',
    'TTS.DETAIL',
    'TTS.LIST',
  ])
  async findOne(@Param() params: FindOneReadingHistoryRequest) {
    return await this.service.findOne(params);
  }

  @Post()
  @Permissions([
    'READING_HISTORY.CREATE',
    'OCR.CREATE',
    'OCR.LIST',
    'TTS.CREATE',
    'TTS.LIST',
  ])
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateReadingHistoryRequest })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
          return cb(
            new BadRequestException('Only PNG or JPG images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateReadingHistoryRequest,
    @Req() req: any,
  ) {
    return await this.service.create(file, {
      name: body.name,
      voice: body.voice,
      lang: body.lang,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Post(':historyId/retry')
  @Permissions([
    'READING_HISTORY.UPDATE',
    'READING_HISTORY.CREATE',
    'OCR.UPDATE',
    'OCR.CREATE',
    'TTS.UPDATE',
    'TTS.CREATE',
  ])
  async retry(@Param() params: FindOneReadingHistoryRequest) {
    return await this.service.retry(params);
  }
  @Patch(':historyId')
  @Permissions(['READING_HISTORY.UPDATE'])
  async update(
    @Param() params: FindOneReadingHistoryRequest,
    @Body() body: UpdateReadingHistoryRequest,
  ) {
    return await this.service.update({
      ...body,
      historyId: params.historyId,
    });
  }

  @Post(':historyId/restore')
  @Permissions(['READING_HISTORY.DELETE'])
  async restore(@Param() params: FindOneReadingHistoryRequest) {
    return await this.service.restore(params.historyId);
  }

  @Delete(':historyId')
  @Permissions(['READING_HISTORY.DELETE'])
  async delete(
    @Param() params: FindOneReadingHistoryRequest,
    @Query() query: DeleteReadingHistoryRequest,
  ) {
    return await this.service.delete({
      historyId: params.historyId,
      isForceDelete: query.isForceDelete,
    });
  }
}
