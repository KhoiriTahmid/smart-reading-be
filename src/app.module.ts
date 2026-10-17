import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { DevicesModule } from './modules/devices/devices.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { UserModel } from './modules/users/users.entity';
import { DeviceModel } from './modules/devices/devices.entity';
import { RoleModel } from './modules/roles/roles.entity';

@Module({
  imports: [
    SequelizeModule.forRoot({
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      dialect: 'postgres',
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      synchronize: false,
      logging: false,
      models: [UserModel, DeviceModel, RoleModel],
    }),
    UsersModule,
    DevicesModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
