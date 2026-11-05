import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const mockOcrClient = {
    isHealthy: jest.fn(),
  };

  const mockQueue = {
    getJobCounts: jest.fn(),
  };

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(mockOcrClient as any, mockQueue as any);
  });

  it('returns healthy status and sums active/waiting/delayed queue tasks', async () => {
    mockOcrClient.isHealthy.mockResolvedValue(true);
    mockQueue.getJobCounts.mockResolvedValue({
      active: 1,
      waiting: 2,
      delayed: 0,
    });

    const summary = await service.getSummary();

    expect(summary.backend.healthy).toBe(true);
    expect(summary.backend.ocrServiceHealthy).toBe(true);
    expect(typeof summary.backend.latencyMs).toBe('number');
    expect(summary.queueTasks).toBe(3);
  });

  it('handles unhealthy OCR service and queue error gracefully', async () => {
    mockOcrClient.isHealthy.mockRejectedValue(new Error('down'));
    mockQueue.getJobCounts.mockRejectedValue(new Error('redis down'));

    const summary = await service.getSummary();

    expect(summary.backend.healthy).toBe(false);
    expect(summary.queueTasks).toBe(0);
  });
});
