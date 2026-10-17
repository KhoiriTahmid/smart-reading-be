import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserModel } from './users.entity';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoleModel } from '../roles/roles.entity';
import { DeviceModel } from '../devices/devices.entity';

@Module({
  imports: [SequelizeModule.forFeature([UserModel, RoleModel, DeviceModel])],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}

