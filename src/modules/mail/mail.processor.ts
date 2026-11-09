import { WorkerHost, Processor, OnWorkerEvent } from '@nestjs/bullmq';
import {
  MAIL_QUEUE,
  MAIL_TRANSPORTER,
  MailJobName,
  ResetPasswordJobData,
  VerifyEmailJobData,
} from './mail.constants';
import { Job, UnrecoverableError } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { Inject, Logger } from '@nestjs/common';
import { MailService } from './mail.service';

@Processor(MAIL_QUEUE, { concurrency: 1 })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORTER) private readonly transporter: Transporter,
  ) {
    super();
  }

  async process(
    job: Job<VerifyEmailJobData | ResetPasswordJobData>,
  ): Promise<nodemailer.SentMessageInfo> {
    const isVerifEmail = job.name === MailJobName.VERIFY_EMAIL;
    const encodedToken = encodeURIComponent(job.data.token);
    const url = isVerifEmail
      ? `${process.env.BACKEND_URL}/auth/verify-email?token=${encodedToken}`
      : `${process.env.FRONTEND_URL}/reset-password?token=${encodedToken}`;

    const subject = isVerifEmail
      ? 'Verify your email address · Smart Reading'
      : 'Reset your password · Smart Reading';

    const html = this.buildEmailHtml({
      name: job.data.name,
      url,
      isVerifEmail,
    });

    return await this.transporter.sendMail({
      from: `"Smart Reading" <${process.env.SMTP_USER}>`,
      to: job.data.email,
      subject,
      html,
    });
  }

  private buildEmailHtml(params: {
    name: string;
    url: string;
    isVerifEmail: boolean;
  }): string {
    const { name, url, isVerifEmail } = params;
    const year = new Date().getFullYear();

    const badgeText = isVerifEmail ? 'EMAIL VERIFICATION' : 'PASSWORD RESET';
    const heading = isVerifEmail
      ? 'Verify your email address'
      : 'Reset your password';
    const description = isVerifEmail
      ? 'Thank you for creating a Smart Reading account. Please confirm your email address by clicking the button below so you can sign in and access your reading dashboard.'
      : 'We received a request to reset the password for your Smart Reading account. Click the button below to choose a new password.';
    const buttonLabel = isVerifEmail
      ? 'Verify Email Address'
      : 'Reset Password';
    const expiryNote = isVerifEmail
      ? 'This verification link will expire in 24 hours. If you did not create a Smart Reading account, you can safely ignore this email.'
      : 'This password reset link is valid for one-time use and will expire in 24 hours. If you did not request a password reset, no action is required and your password will remain unchanged.';

    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${heading}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #FAF5EC; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #12151c; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FAF5EC; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #ffffff; border: 1px solid #EDE3D3; border-radius: 20px; overflow: hidden; box-shadow: 0 18px 50px -28px rgba(18, 21, 28, 0.18);">
            <!-- Top Accent Bar -->
            <tr>
              <td style="height: 6px; background: linear-gradient(90deg, #10b981 0%, #059669 100%);"></td>
            </tr>

            <!-- Header -->
            <tr>
              <td style="padding: 32px 36px 0 36px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="background-color: #10b981; color: #ffffff; font-weight: 800; font-size: 16px; width: 36px; height: 36px; text-align: center; border-radius: 10px; line-height: 36px;">
                      SR
                    </td>
                    <td style="padding-left: 12px;">
                      <div style="font-size: 16px; font-weight: 700; color: #12151c; line-height: 1.2;">Smart Reading</div>
                      <div style="font-size: 12px; color: #6b7280;">IoT Reading Companion</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding: 28px 36px 32px 36px;">
                <div style="display: inline-block; background-color: #e8f8f2; color: #059669; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 5px 12px; border-radius: 999px; margin-bottom: 16px;">
                  ${badgeText}
                </div>

                <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #12151c; letter-spacing: -0.02em;">
                  ${heading}
                </h1>

                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                  Hi <strong>${name}</strong>,
                </p>

                <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                  ${description}
                </p>

                <!-- CTA Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px 0;">
                  <tr>
                    <td align="center" style="border-radius: 12px; background-color: #10b981;">
                      <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px; background-color: #10b981;">
                        ${buttonLabel}
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Security / Expiry Box -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;">
                  <tr>
                    <td style="padding: 14px 16px; font-size: 13px; line-height: 1.5; color: #6b7280;">
                      ${expiryNote}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 20px 36px; background-color: #fafaf9; border-top: 1px solid #EDE3D3; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  &copy; ${year} Smart Reading. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, err: Error) {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const permanent =
      err instanceof UnrecoverableError ||
      err.name === 'UnrecoverableError' ||
      job.attemptsMade >= maxAttempts;

    this.logger.warn(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}` +
        `${permanent ? ', final' : ''}): ${err.message}`,
    );

    return;
  }
}

