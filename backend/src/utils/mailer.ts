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
    subject: `Your Gupshup Verification Code: ${code}`,
    text: `Your verification code for ${purposeDescription} is: ${code}. This code will expire in ${Math.round(env.OTP_TTL_SECONDS / 60)} minutes.`,
    html: `
      <div style="font-family: 'Nunito Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #E9E1D3; border-radius: 16px; background-color: #FAF6EF; color: #2E2A26;">
        <h2 style="color: #A96100; margin-bottom: 8px;">Gupshup</h2>
        <p style="font-size: 14px; color: #7A7168;">${purposeDescription}</p>
        <div style="margin: 24px 0; padding: 16px; background-color: #FFFFFF; border-radius: 12px; text-align: center; border: 1.5px solid #E9E1D3;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2E2A26;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #7A7168;">This code expires in ${Math.round(env.OTP_TTL_SECONDS / 60)} minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
    code,
  };

  // Capture for automated tests
  capturedMails.push({ ...mail, sentAt: new Date() });

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      // In development fallback, log the code to console so developer can test locally
      logger.info(
        `[DEV MAIL FALLBACK] OTP for ${to} (${purposeDescription}): >>> ${code} <<<`
      );
      return;
    }
    logger.warn('SMTP credentials not configured. Email could not be sent.');
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
    if (env.NODE_ENV === 'development') {
      logger.info(`[DEV MAIL FALLBACK] OTP for ${to}: >>> ${code} <<<`);
    }
  }
}
