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
import { UsersService } from './users.service';
import {
  CreateUserRequest,
  DeleteUserRequest,
  FindAllUserRequest,
  FindOneUserRequest,
  UpdateUserRequest,
} from './users.contract';

@Controller('users')
export class UsersController {
  constructor(
    @Inject()
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async findAll(@Query() query: FindAllUserRequest) {
    return await this.usersService.findAll(query);
  }

  @Get(':userId')
  async findOne(@Param() params: FindOneUserRequest) {
    return await this.usersService.findOne(params);
  }

  @Post()
  async create(@Body() body: CreateUserRequest, @Req() req: any) {
    return await this.usersService.create({
      ...body,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Patch(':userId')
  async update(
    @Param() params: FindOneUserRequest,
    @Body() body: UpdateUserRequest,
  ) {
    return await this.usersService.update({
      ...body,
      userId: params.userId,
    });
  }

  @Post(':userId/restore')
  async restore(@Param() params: FindOneUserRequest) {
    return await this.usersService.restore(params.userId);
  }

  @Delete(':userId')
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

