import crypto from 'crypto';
import { redis } from '../redis/client';
import { env } from '../config/env';
import { BadRequestError, TooManyRequestsError } from './errors';

export type OtpPurpose = 'signup' | 'forgot_password' | 'change_email';

const MAX_WRONG_ATTEMPTS = 5;

export function generate6DigitOtp(): string {
  // Cryptographically secure random 6-digit number
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Cooldown progression:
 * 1st resend: 30s
 * 2nd resend: 60s
 * 3rd resend and beyond: 120s
 */
function getCooldownSeconds(resendCount: number): number {
  if (resendCount <= 0) return 30;
  if (resendCount === 1) return 60;
  return 120;
}

export interface CreateOtpResult {
  code: string;
  cooldownSeconds: number;
}

export async function createAndStoreOtp(email: string, purpose: OtpPurpose): Promise<CreateOtpResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const cooldownKey = `otp_cooldown:${purpose}:${normalizedEmail}`;
  const otpKey = `otp:${purpose}:${normalizedEmail}`;
  const attemptsKey = `otp_attempts:${purpose}:${normalizedEmail}`;
  const resendCountKey = `otp_resend_count:${purpose}:${normalizedEmail}`;

  // Check active cooldown
  const inCooldown = await redis.exists(cooldownKey);
  if (inCooldown) {
    const ttl = await redis.ttl(cooldownKey);
    const retryAfterSeconds = ttl > 0 ? ttl : 30;
    throw new TooManyRequestsError(
      `Please wait ${retryAfterSeconds} seconds before requesting a new code`,
      'OTP_COOLDOWN',
      { retryAfterSeconds },
      retryAfterSeconds
    );
  }

  // Get current resend count
  const countStr = await redis.get(resendCountKey);
  const resendCount = countStr ? parseInt(countStr, 10) : 0;
  const cooldownSeconds = getCooldownSeconds(resendCount);

  const code = generate6DigitOtp();

  // Store OTP with configured TTL (separate from cooldown, 10 minutes)
  await redis.set(otpKey, code, 'EX', env.OTP_TTL_SECONDS);

  // Set cooldown with escalating duration
  await redis.set(cooldownKey, '1', 'EX', cooldownSeconds);

  // Increment resend count with OTP TTL
  await redis.set(resendCountKey, String(resendCount + 1), 'EX', env.OTP_TTL_SECONDS);

  // Reset wrong attempts counter
  await redis.del(attemptsKey);

  return { code, cooldownSeconds };
}

export async function verifyStoredOtp(email: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const otpKey = `otp:${purpose}:${normalizedEmail}`;
  const attemptsKey = `otp_attempts:${purpose}:${normalizedEmail}`;
  const cooldownKey = `otp_cooldown:${purpose}:${normalizedEmail}`;
  const resendCountKey = `otp_resend_count:${purpose}:${normalizedEmail}`;

  const storedCode = await redis.get(otpKey);
  if (!storedCode) {
    throw new BadRequestError('Verification code has expired or is invalid', 'OTP_EXPIRED');
  }

  if (storedCode !== code.trim()) {
    const currentAttempts = await redis.incr(attemptsKey);
    // Align attempts TTL with OTP TTL
    const ttl = await redis.ttl(otpKey);
    if (ttl > 0) {
      await redis.expire(attemptsKey, ttl);
    }

    if (currentAttempts >= MAX_WRONG_ATTEMPTS) {
      await redis.del(otpKey);
      await redis.del(attemptsKey);
      await redis.del(cooldownKey);
      await redis.del(resendCountKey);
      throw new BadRequestError(
        'Maximum verification attempts exceeded. Please request a new code.',
        'OTP_MAX_ATTEMPTS'
      );
    }

    const remaining = MAX_WRONG_ATTEMPTS - currentAttempts;
    throw new BadRequestError(
      `Invalid verification code. ${remaining} attempt(s) remaining.`,
      'OTP_INVALID',
      { remainingAttempts: remaining }
    );
  }

  // Code is valid - clean up keys
  await redis.del(otpKey);
  await redis.del(attemptsKey);
  await redis.del(cooldownKey);
  await redis.del(resendCountKey);

  return true;
}
