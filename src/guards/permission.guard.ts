import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISSION_KEY = 'PERMISSIONS';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest();

    if (Boolean(user?.permissions?.['FULL_ACCESS'])) return true;
    if (
      requiredPermissions.some((permission) =>
        Boolean(user?.permissions?.[permission]),
      )
    )
      return true;
    return false;
  }
}
