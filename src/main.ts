import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as appJSON from '../app.json';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle(appJSON.name)
    .setDescription(
      [
        'API Documentation',
        '',
        '**Testing auth from Swagger**',
        '1. Call `POST /auth/signin-by-email` with `isRedirect=false`.',
        '2. Copy `access_token` from the response.',
        '3. Click **Authorize** and paste it as the Bearer token.',
        '   After `/auth/refresh`, paste the new `access_token` there too.',
        '',
        'The `refresh_token` is stored as an httpOnly cookie, so `/auth/refresh`',
        'uses it automatically when Swagger UI is opened on the same origin.',
        '',
        'Open Swagger at `http://localhost:3001/docs` (not `127.0.0.1`)',
        'so the cookies set by login are sent on subsequent requests.',
      ].join('\n'),
    )
    .setVersion(appJSON.version)
    .addBearerAuth()
    .build();

  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(process.env.SWAGGER_DOCS_PATH ?? 'docs', app, doc, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.info('App run successfully at localhost:' + port);
}
void bootstrap();
