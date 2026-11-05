import { DevicesController } from './devices.controller';

describe('DevicesController', () => {
  const mockDevicesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
  };

  let controller: DevicesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DevicesController(mockDevicesService as any);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
