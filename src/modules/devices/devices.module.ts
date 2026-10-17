import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { DeviceModel } from './devices.entity';
import { UserModel } from '../users/users.entity';

@Module({
  imports: [SequelizeModule.forFeature([DeviceModel, UserModel])],
  providers: [DevicesService],
  controllers: [DevicesController],
})
export class DevicesModule {}
