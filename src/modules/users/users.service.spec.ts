import { UsersService } from './users.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileRequest } from './users.contract';

describe('UsersService & Contracts', () => {
  const mockUserModel = {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    destroy: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BCRYPT_SALT_ROUNDS = '4';
    process.env.ROLE_USER_ID = 'default-role-uuid';
    service = new UsersService(mockUserModel as any);
  });

  it('allows roleId in UpdateProfileRequest validation', async () => {
    const dto = plainToInstance(UpdateProfileRequest, {
      roleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto.roleId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('updates user roleId via UsersService.update', async () => {
    mockUserModel.update.mockResolvedValue([1]);
    await service.update({
      userId: 'user-1',
      roleId: 'role-2',
    });

    expect(mockUserModel.update).toHaveBeenCalledWith(
      { roleId: 'role-2' },
      { where: { userId: 'user-1' }, returning: false },
    );
  });
});
