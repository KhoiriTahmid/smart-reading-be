import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ReadingHistoryModel } from './readingHistory.entity';
import { ReadingHistoriesController } from './readingHistory.controller';
import { ReadingHistoriesService } from './readingHistory.service';
import { ReadingHistoriesProcessor } from './readingHistory.processor';
import { StorageModule } from '../storage/storage.module';
import { OcrClientModule } from '../ocr-tts/ocr-tts.module';
import { BullModule } from '@nestjs/bullmq';
import { READINGS_QUEUE } from './readingHistory.pipeline';

@Module({
  imports: [
    SequelizeModule.forFeature([ReadingHistoryModel]),
    BullModule.registerQueue({ name: READINGS_QUEUE }),
    StorageModule,
    OcrClientModule,
  ],
  controllers: [ReadingHistoriesController],
  providers: [ReadingHistoriesService, ReadingHistoriesProcessor],
})
export class ReadingHistoriesModule {}
