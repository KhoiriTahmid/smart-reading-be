import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { DevicesModule } from './modules/devices/devices.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { UserModel } from './modules/users/users.entity';
import { DeviceModel } from './modules/devices/devices.entity';
import { RoleModel } from './modules/roles/roles.entity';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CommnonExceptionsFilter } from './modules/common/exceptions.filter';
import { ResponseInterceptor } from './modules/common/response.interceptor';
import { ReadingHistoriesModule } from './modules/reading-history/readingHistory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReadingHistoryModel } from './modules/reading-history/readingHistory.entity';
import { BullModule } from '@nestjs/bullmq';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        transport: isProd
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true } },
        genReqId: (req, res) => {
          const id = req.headers['x-request-id'] ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
            'req.body.password',
            '*.phoneNumber',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    SequelizeModule.forRoot({
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      dialect: 'postgres',
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      synchronize: false,
      logging: false,
      models: [UserModel, DeviceModel, RoleModel, ReadingHistoryModel],
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: Number(config.get('REDIS_PORT') ?? 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    AuthModule,
    UsersModule,
    DevicesModule,
    RolesModule,
    ReadingHistoriesModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: CommnonExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
