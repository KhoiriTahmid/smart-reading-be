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
} from '@nestjs/common';
import { RolesService } from './roles.service';
import {
  CreateRoleRequest,
  DeleteRoleRequest,
  FindAllRoleRequest,
  UpdateRoleRequest,
} from './roles.contract';

@Controller('roles')
export class RolesController {
  constructor(
    @Inject()
    private readonly rolesService: RolesService,
  ) {}

  @Get()
  async findAll(@Query() params: FindAllRoleRequest) {
    return await this.rolesService.findAll(params);
  }

  @Get(':roleId')
  async findOne(@Param('roleId') roleId: string) {
    return await this.rolesService.findOne({ roleId });
  }

  @Post()
  async create(@Body() params: CreateRoleRequest, @Req() req: any) {
    return await this.rolesService.create({
      ...params,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Patch(':roleId')
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
  async restore(@Param('roleId') roleId: string) {
    return await this.rolesService.restore(roleId);
  }

  @Delete(':roleId')
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
