import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionGuard } from './permission.guard';
import { UsersController } from '../modules/users/users.controller';
import { RolesController } from '../modules/roles/roles.controller';
import { ReadingHistoriesController } from '../modules/reading-history/readingHistory.controller';
import { DashboardController } from '../modules/dashboard/dashboard.controller';

const makeContext = (
  permissions: Record<string, boolean> | undefined,
): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user: permissions ? { permissions } : undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('PermissionGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionGuard(reflector);

  const withRequired = (required: string[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

  afterEach(() => jest.restoreAllMocks());

  it('allows when the route declares no permissions', () => {
    withRequired(undefined);
    expect(guard.canActivate(makeContext({}))).toBe(true);
    withRequired([]);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows FULL_ACCESS for any required permission', () => {
    withRequired(['ROLE.DELETE']);
    expect(guard.canActivate(makeContext({ FULL_ACCESS: true }))).toBe(true);
  });

  it('allows when the user has at least one of the required permissions', () => {
    withRequired(['USER.LIST', 'USER.CREATE']);
    expect(guard.canActivate(makeContext({ 'USER.CREATE': true }))).toBe(true);
  });

  it('denies when permissions are present but false', () => {
    withRequired(['USER.LIST']);
    expect(
      guard.canActivate(makeContext({ 'USER.LIST': false, FULL_ACCESS: false })),
    ).toBe(false);
  });

  it('denies when the user has no permissions object', () => {
    withRequired(['DASHBOARD']);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('denies when the user only has unrelated permissions', () => {
    withRequired(['ROLE.UPDATE']);
    expect(guard.canActivate(makeContext({ 'OCR.CREATE': true }))).toBe(false);
  });
});

/**
 * Pins down which permissions each route accepts, so loosening or
 * tightening access is always a visible, deliberate change.
 */
describe('Route permission metadata', () => {
  const required = (controller: any, method: string): string[] =>
    Reflect.getMetadata(PERMISSION_KEY, controller.prototype[method]);

  it('dashboard requires DASHBOARD', () => {
    expect(required(DashboardController, 'getSummary')).toEqual(['DASHBOARD']);
  });

  it('users: list accepts any USER.* permission, mutations stay strict', () => {
    expect(required(UsersController, 'findAll')).toEqual([
      'USER.LIST',
      'USER.DETAIL',
      'USER.CREATE',
      'USER.UPDATE',
      'USER.DELETE',
    ]);
    expect(required(UsersController, 'findOne')).toEqual(['USER.DETAIL']);
    expect(required(UsersController, 'create')).toEqual(['USER.CREATE']);
    expect(required(UsersController, 'update')).toEqual(['USER.UPDATE']);
    expect(required(UsersController, 'delete')).toEqual(['USER.DELETE']);
    expect(required(UsersController, 'restore')).toEqual(['USER.DELETE']);
  });

  it('roles: list is also readable by user managers (role dropdown)', () => {
    const list = required(RolesController, 'findAll');
    expect(list).toEqual(
      expect.arrayContaining(['ROLE.LIST', 'USER.CREATE', 'USER.UPDATE']),
    );
    expect(required(RolesController, 'update')).toEqual(['ROLE.UPDATE']);
    expect(required(RolesController, 'create')).toEqual(['ROLE.CREATE']);
    expect(required(RolesController, 'delete')).toEqual(['ROLE.DELETE']);
  });

  it('reading histories: OCR/TTS users can create, poll and retry jobs', () => {
    expect(required(ReadingHistoriesController, 'create')).toEqual(
      expect.arrayContaining(['READING_HISTORY.CREATE', 'OCR.CREATE']),
    );
    expect(required(ReadingHistoriesController, 'findOne')).toEqual(
      expect.arrayContaining(['READING_HISTORY.DETAIL', 'OCR.CREATE']),
    );
    expect(required(ReadingHistoriesController, 'retry')).toEqual(
      expect.arrayContaining(['READING_HISTORY.UPDATE', 'OCR.UPDATE']),
    );
  });

  it('reading histories: delete and update stay restricted', () => {
    expect(required(ReadingHistoriesController, 'delete')).toEqual([
      'READING_HISTORY.DELETE',
    ]);
    expect(required(ReadingHistoriesController, 'update')).toEqual([
      'READING_HISTORY.UPDATE',
    ]);
    expect(required(ReadingHistoriesController, 'findAll')).not.toContain(
      'OCR.CREATE',
    );
  });
});
