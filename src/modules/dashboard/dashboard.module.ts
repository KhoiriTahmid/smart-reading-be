import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OcrClientModule } from '../ocr-tts/ocr-tts.module';
import { READINGS_QUEUE } from '../reading-history/readingHistory.pipeline';

@Module({
  imports: [
    BullModule.registerQueue({ name: READINGS_QUEUE }),
    OcrClientModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
