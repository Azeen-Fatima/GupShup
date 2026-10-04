import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

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

  // Capture for automated tests
  capturedMails.push({ ...mail, sentAt: new Date() });

  // In development, always log the OTP to the terminal (even when SMTP succeeds). Never log in production.
  if (env.NODE_ENV === 'development') {
    logger.info(`[DEV OTP] Code for ${to} (${purposeDescription}): >>> ${code} <<<`);
  }

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      logger.warn('SMTP credentials not configured. Email could not be sent.');
    }
    return;
  }

  try {
    await mailTransporter.sendMail({
      from: env.MAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    logger.info({ to }, 'OTP email successfully dispatched via SMTP');
  } catch (err: any) {
    logger.error({ err: err.message, to }, 'Failed to dispatch email via SMTP');
  }
}
