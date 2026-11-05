import { RolesController } from './roles.controller';
import { PermissionGuard } from 'src/guards/permission.guard';
import { Reflector } from '@nestjs/core';

describe('RolesController & PermissionGuard', () => {
  const mockRolesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
  };

  let controller: RolesController;
  let guard: PermissionGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RolesController(mockRolesService as any);
    guard = new PermissionGuard(new Reflector());
  });

  it('updates role permissions via PATCH /roles/:roleId', async () => {
    mockRolesService.update.mockResolvedValue([1]);
    await controller.update(
      { permissions: { DASHBOARD: false } },
      'role-123',
    );
    expect(mockRolesService.update).toHaveBeenCalledWith({
      roleId: 'role-123',
      permissions: { DASHBOARD: false },
    });
  });

  it('PermissionGuard allows FULL_ACCESS or matching permission and denies missing permission', () => {
    const makeCtx = (permissions: Record<string, boolean>) =>
      ({
        getHandler: () => controller.update,
        getClass: () => RolesController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { permissions } }),
        }),
      }) as any;

    expect(guard.canActivate(makeCtx({ FULL_ACCESS: true }))).toBe(true);
    expect(guard.canActivate(makeCtx({ 'ROLE.UPDATE': true }))).toBe(true);
    expect(guard.canActivate(makeCtx({ 'ROLE.LIST': true }))).toBe(false);
  });
});
