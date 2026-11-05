import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PERMISSION_KEY, PermissionGuard } from 'src/guards/permission.guard';

export const Permissions = (permissions: string[]) => {
  return applyDecorators(
    SetMetadata(
      PERMISSION_KEY,
      permissions.map((v) => v.trim()).filter((v) => v.length),
    ),
    UseGuards(PermissionGuard),
  );
};
