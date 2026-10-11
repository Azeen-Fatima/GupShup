import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ServiceUnavailableError } from './errors';

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  code?: string;
}

export interface CapturedMail extends MailOptions {
  sentAt: Date;
}

// In-memory capture for tests
export const capturedMails: CapturedMail[] = [];

export function getCapturedMails(): CapturedMail[] {
  return capturedMails;
}

export function clearCapturedMails(): void {
  capturedMails.length = 0;
}

export type EmailProviderType = 'gmail' | 'resend' | 'smtp' | 'log_only';

export function getActiveEmailProvider(): EmailProviderType {
  if (
    env.GMAIL_CLIENT_ID &&
    env.GMAIL_CLIENT_ID.trim().length > 0 &&
    env.GMAIL_CLIENT_SECRET &&
    env.GMAIL_CLIENT_SECRET.trim().length > 0 &&
    env.GMAIL_REFRESH_TOKEN &&
    env.GMAIL_REFRESH_TOKEN.trim().length > 0
  ) {
    return 'gmail';
  }
  if (env.RESEND_API_KEY && env.RESEND_API_KEY.trim().length > 0) {
    return 'resend';
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return 'smtp';
  }
  return 'log_only';
}

let hasLoggedProvider = false;
export function logActiveEmailProvider(): void {
  if (hasLoggedProvider) return;
  hasLoggedProvider = true;

  const provider = getActiveEmailProvider();
  if (provider === 'gmail') {
    logger.info('[Email] Active email provider: Gmail API via OAuth2 (Primary)');
  } else if (provider === 'resend') {
    logger.info('[Email] Active email provider: Resend HTTP API (Secondary fallback)');
  } else if (provider === 'smtp') {
    logger.info('[Email] Active email provider: SMTP (Nodemailer fallback)');
  } else {
    logger.info('[Email] Active email provider: Console/Log-only (No external mail credentials set)');
  }
}

export function buildRawMimeMessage(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): string {
  const boundary = `gupshup_part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const encodedSubject = `=?utf-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=`;

  const lines: string[] = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
  ];

  if (options.html) {
    lines.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.html,
      '',
      `--${boundary}--`
    );
  } else {
    lines.push(
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.text
    );
  }

  const rawMime = lines.join('\r\n');
  return Buffer.from(rawMime, 'utf-8').toString('base64url');
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendOtpEmail(to: string, code: string, purposeDescription: string): Promise<void> {
  const mail: MailOptions = {
    to,
    subject: `Your Gupshup code: ${code}`,
    text: `Your Gupshup code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this code, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 440px; margin: 0 auto; padding: 24px; border: 1px solid #E9E1D3; border-radius: 12px; background-color: #FAF6EF; color: #2E2A26;">
        <h2 style="color: #A96100; margin-top: 0; margin-bottom: 8px; font-size: 20px;">Gupshup</h2>
        <p style="font-size: 14px; color: #666; margin-bottom: 16px;">Here is your verification code for ${purposeDescription}:</p>
        <div style="background-color: #FFFFFF; border: 1.5px solid #E9E1D3; border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 16px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2E2A26;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #777; margin-bottom: 4px;">This code expires in 10 minutes.</p>
        <p style="font-size: 12px; color: #999; margin: 0;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
    code,
  };

  // Capture for automated test verification
  capturedMails.push({ ...mail, sentAt: new Date() });

  // Prominent terminal logging ONLY when NODE_ENV !== 'production'
  if (env.NODE_ENV !== 'production') {
    logger.info(`[OTP] For: ${to} | Code: ${code} | Expires: 10m`);
  }

  const provider = getActiveEmailProvider();

  // 1. Gmail API via OAuth2 path
  if (provider === 'gmail') {
    try {
      const oauth2Client = new OAuth2Client(
        env.GMAIL_CLIENT_ID.trim(),
        env.GMAIL_CLIENT_SECRET.trim()
      );
      oauth2Client.setCredentials({
        refresh_token: env.GMAIL_REFRESH_TOKEN.trim(),
      });

      const { token: accessToken } = await oauth2Client.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token from Google OAuth2 client');
      }

      const fromAddress = env.GMAIL_SENDER?.trim() || env.MAIL_FROM;
      const raw = buildRawMimeMessage({
        from: fromAddress,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(
          { status: response.status, body: errorText, to },
          'Gmail API error response when sending OTP'
        );
        throw new ServiceUnavailableError(
          "We couldn't send the email right now. Please try again.",
          'EMAIL_SEND_FAILED'
        );
      }

      logger.info({ to }, 'OTP email successfully dispatched via Gmail API');
      return;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableError) {
        throw err;
      }
      logger.error({ err: err.message, to }, 'Failed to send email via Gmail API');
      throw new ServiceUnavailableError(
        "We couldn't send the email right now. Please try again.",
        'EMAIL_SEND_FAILED'
      );
    }
  }

  // 2. Resend HTTP API path
  if (provider === 'resend') {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(
          { status: response.status, body: errorText, to },
          'Resend API error response when sending OTP'
        );
        throw new ServiceUnavailableError(
          "We couldn't send the email right now. Please try again.",
          'EMAIL_SEND_FAILED'
        );
      }

      logger.info({ to }, 'OTP email successfully dispatched via Resend HTTP API');
      return;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableError) {
        throw err;
      }
      logger.error({ err: err.message, to }, 'Failed to connect to Resend API');
      throw new ServiceUnavailableError(
        "We couldn't send the email right now. Please try again.",
        'EMAIL_SEND_FAILED'
      );
    }
  }

  // 3. SMTP Nodemailer path
  if (provider === 'smtp') {
    const mailTransporter = getTransporter();
    if (mailTransporter) {
      try {
        await mailTransporter.sendMail({
          from: env.MAIL_FROM,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        logger.info({ to }, 'OTP email successfully dispatched via SMTP');
        return;
      } catch (err: any) {
        logger.error({ err: err.message, to }, 'Failed to dispatch email via SMTP');
      }
    }
    return;
  }

  // 4. Log-only path (development / test without credentials)
  if (env.NODE_ENV === 'production') {
    logger.warn('No email provider configured in production (GMAIL_, RESEND_API_KEY, or SMTP credentials missing).');
  }
}
