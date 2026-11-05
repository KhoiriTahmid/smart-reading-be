import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OcrTtsService } from '../ocr-tts/ocr-tts.service';
import { READINGS_QUEUE } from '../reading-history/readingHistory.pipeline';

export interface DashboardSummary {
  backend: {
    healthy: boolean;
    latencyMs: number | null;
    ocrServiceHealthy: boolean;
  };
  queueTasks: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly ocrClient: OcrTtsService,
    @InjectQueue(READINGS_QUEUE) private readonly queue: Queue,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const start = Date.now();
    const [ocrHealthy, queueTasks] = await Promise.all([
      this.ocrClient.isHealthy().catch(() => false),
      this.getQueueTaskCount(),
    ]);
    const latencyMs = Date.now() - start;

    return {
      backend: {
        healthy: ocrHealthy,
        latencyMs,
        ocrServiceHealthy: ocrHealthy,
      },
      queueTasks,
    };
  }

  private async getQueueTaskCount(): Promise<number> {
    try {
      const counts = await this.queue.getJobCounts('active', 'waiting', 'delayed');
      return (counts.active ?? 0) + (counts.waiting ?? 0) + (counts.delayed ?? 0);
    } catch {
      return 0;
    }
  }
}
