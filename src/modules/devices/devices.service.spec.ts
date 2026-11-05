import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  const mockDeviceModel = {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    destroy: jest.fn(),
  };

  let service: DevicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DevicesService(mockDeviceModel as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
