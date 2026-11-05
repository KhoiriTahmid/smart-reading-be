import { UsersController } from './users.controller';

describe('UsersController', () => {
  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
  };

  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UsersController(mockUsersService as any);
  });

  it('creates a user with roleId and password', async () => {
    mockUsersService.create.mockResolvedValue({ userId: 'u-1' });
    await controller.create(
      {
        name: 'Budi',
        email: 'budi@example.com',
        password: 'password123',
        roleId: 'role-1',
      },
      { user: { userId: 'admin-1' } },
    );

    expect(mockUsersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Budi',
        email: 'budi@example.com',
        password: 'password123',
        roleId: 'role-1',
        createdByUserId: 'admin-1',
      }),
    );
  });

  it('updates user role via PATCH /users/:userId', async () => {
    mockUsersService.update.mockResolvedValue([1]);
    await controller.update(
      { userId: 'u-1' },
      { roleId: 'role-2' },
    );

    expect(mockUsersService.update).toHaveBeenCalledWith({
      userId: 'u-1',
      roleId: 'role-2',
    });
  });
});
