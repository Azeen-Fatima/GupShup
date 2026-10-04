import nodemailer from 'nodemailer';
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

export type EmailProviderType = 'resend' | 'smtp' | 'log_only';

export function getActiveEmailProvider(): EmailProviderType {
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
  if (provider === 'resend') {
    logger.info('[Email] Active email provider: Resend HTTP API (Primary)');
  } else if (provider === 'smtp') {
    logger.info('[Email] Active email provider: SMTP (Nodemailer fallback)');
  } else {
    logger.info('[Email] Active email provider: Console/Log-only (No external mail credentials set)');
  }
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

  // 1. Resend HTTP API path
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

  // 2. SMTP Nodemailer path
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

  // 3. Log-only path (development / test without credentials)
  if (env.NODE_ENV === 'production') {
    logger.warn('No email provider configured in production (RESEND_API_KEY or SMTP credentials missing).');
  }
}
