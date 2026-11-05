import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserRequestByEmail,
  DeleteUserRequest,
  FindAllUserRequest,
  FindOneUserRequest,
  UpdateProfileRequest,
} from './users.contract';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionGuard } from 'src/guards/permission.guard';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions([
    'USER.LIST',
    'USER.DETAIL',
    'USER.CREATE',
    'USER.UPDATE',
    'USER.DELETE',
  ])
  async findAll(@Query() query: FindAllUserRequest) {
    return await this.usersService.findAll(query);
  }

  @Get(':userId')
  @Permissions(['USER.DETAIL'])
  async findOne(@Param() params: FindOneUserRequest) {
    return await this.usersService.findOne(params);
  }

  @Post()
  @Permissions(['USER.CREATE'])
  async create(@Body() body: CreateUserRequestByEmail, @Req() req: any) {
    return await this.usersService.create({
      ...body,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Patch(':userId')
  @Permissions(['USER.UPDATE'])
  async update(
    @Param() params: FindOneUserRequest,
    @Body() body: UpdateProfileRequest,
  ) {
    return await this.usersService.update({
      ...body,
      userId: params.userId,
    });
  }

  @Post(':userId/restore')
  @Permissions(['USER.DELETE'])
  async restore(@Param() params: FindOneUserRequest) {
    return await this.usersService.restore(params.userId);
  }

  @Delete(':userId')
  @Permissions(['USER.DELETE'])
  async delete(
    @Param() params: FindOneUserRequest,
    @Query() query: DeleteUserRequest,
  ) {
    return await this.usersService.delete({
      userId: params.userId,
      isForceDelete: query.isForceDelete,
    });
  }
}
