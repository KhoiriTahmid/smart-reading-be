import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  const mockDashboardService = {
    getSummary: jest.fn(),
  };

  let controller: DashboardController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DashboardController(mockDashboardService as any);
  });

  it('returns dashboard summary from service', async () => {
    mockDashboardService.getSummary.mockResolvedValue({
      backend: { healthy: true, latencyMs: 5, ocrServiceHealthy: true },
      queueTasks: 2,
    });

    const res = await controller.getSummary();
    expect(res.queueTasks).toBe(2);
    expect(res.backend.healthy).toBe(true);
  });
});
