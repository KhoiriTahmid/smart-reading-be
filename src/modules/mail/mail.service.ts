import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  EMAIL_JOB_OPTIONS,
  MAIL_QUEUE,
  MailJobName,
  ResetPasswordJobData,
  VerifyEmailJobData,
} from './mail.constants';

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue) {}

  async enqueueVerificationEmail(data: VerifyEmailJobData) {
    await this.mailQueue.add(MailJobName.VERIFY_EMAIL, data, EMAIL_JOB_OPTIONS);
  }

  async enqueueResetPasswordEmail(data: ResetPasswordJobData) {
    await this.mailQueue.add(
      MailJobName.RESET_PASSWORD,
      data,
      EMAIL_JOB_OPTIONS,
    );
  }
}
