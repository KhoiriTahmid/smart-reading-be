import { RolesService } from './roles.service';

describe('RolesService', () => {
  const mockRoleModel = {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    destroy: jest.fn(),
  };

  let service: RolesService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ROLE_ADMIN_ID = 'role-admin-id';
    service = new RolesService(mockRoleModel as any);
  });

  it('findAll marks admin role as locked and returns results', async () => {
    mockRoleModel.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        {
          roleId: 'role-admin-id',
          get: () => ({
            roleId: 'role-admin-id',
            name: 'Admin',
            permissions: { FULL_ACCESS: true },
          }),
        },
        {
          roleId: 'role-user-id',
          get: () => ({
            roleId: 'role-user-id',
            name: 'User',
            permissions: { DASHBOARD: true },
          }),
        },
      ],
    });

    const res = await service.findAll({ limit: 10, offset: 0 } as any);
    expect(res.count).toBe(2);
    expect(res.results[0]).toMatchObject({
      roleId: 'role-admin-id',
      locked: true,
    });
    expect(res.results[1]).not.toHaveProperty('locked');
  });

  it('update updates permissions for a role', async () => {
    mockRoleModel.update.mockResolvedValue([1]);

    await service.update({
      roleId: 'role-user-id',
      permissions: { DASHBOARD: true, 'USER.LIST': true },
    });

    expect(mockRoleModel.update).toHaveBeenCalledWith(
      { permissions: { DASHBOARD: true, 'USER.LIST': true } },
      { where: { roleId: 'role-user-id' } },
    );
  });
});
