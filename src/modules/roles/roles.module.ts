import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { UserModel } from '../users/users.entity';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoleModel } from './roles.entity';

@Module({
  imports: [SequelizeModule.forFeature([RoleModel, UserModel])],
  providers: [RolesService],
  controllers: [RolesController],
})
export class RolesModule {}
