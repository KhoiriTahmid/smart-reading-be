import { JobsOptions } from 'bullmq';

export const MAIL_TRANSPORTER = Symbol('MAIL_TRANSPORTER');

export const MAIL_QUEUE = 'mail';

export const MailJobName = {
  VERIFY_EMAIL: 'send-verification-email',
  RESET_PASSWORD: 'send-reset-password-email',
} as const;

export interface VerifyEmailJobData {
  email: string;
  name: string;
  token: string;
}

export interface ResetPasswordJobData {
  email: string;
  name: string;
  token: string;
}

export const EMAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 3_000 },
  removeOnComplete: true,
};
