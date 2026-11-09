import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MAIL_QUEUE, MAIL_TRANSPORTER } from './mail.constants';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  providers: [
    MailService,
    MailProcessor,
    {
      provide: MAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return nodemailer.createTransport({
          host: config.get<string>('SMTP_HOST'),
          port: config.get<number>('SMTP_PORT'),
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        });
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
