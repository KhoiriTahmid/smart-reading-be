import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import {
  CreateRoleRequest,
  DeleteRoleRequest,
  FindAllRoleRequest,
  UpdateRoleRequest,
} from './roles.contract';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionGuard } from 'src/guards/permission.guard';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class RolesController {
  constructor(
    @Inject()
    private readonly rolesService: RolesService,
  ) {}

  @Get()
  @Permissions([
    'ROLE.LIST',
    'ROLE.DETAIL',
    'ROLE.CREATE',
    'ROLE.UPDATE',
    'ROLE.DELETE',
    'USER.LIST',
    'USER.CREATE',
    'USER.UPDATE',
  ])
  async findAll(@Query() params: FindAllRoleRequest) {
    return await this.rolesService.findAll(params);
  }

  @Get(':roleId')
  @Permissions(['ROLE.DETAIL'])
  async findOne(@Param('roleId') roleId: string) {
    return await this.rolesService.findOne({ roleId });
  }

  @Post()
  @Permissions(['ROLE.CREATE'])
  async create(@Body() params: CreateRoleRequest, @Req() req: any) {
    return await this.rolesService.create({
      ...params,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Patch(':roleId')
  @Permissions(['ROLE.UPDATE'])
  async update(
    @Body() params: UpdateRoleRequest,
    @Param('roleId') roleId: string,
  ) {
    return await this.rolesService.update({
      ...params,
      roleId,
    });
  }

  @Post(':roleId/restore')
  @Permissions(['ROLE.DELETE'])
  async restore(@Param('roleId') roleId: string) {
    return await this.rolesService.restore(roleId);
  }

  @Delete(':roleId')
  @Permissions(['ROLE.DELETE'])
  async delete(
    @Param('roleId') roleId: string,
    @Query() params: DeleteRoleRequest,
  ) {
    return await this.rolesService.delete({
      roleId,
      isForceDelete: params.isForceDelete,
    });
  }
}
