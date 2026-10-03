import crypto from 'crypto';
import { redis } from '../redis/client';
import { env } from '../config/env';
import { BadRequestError, TooManyRequestsError } from './errors';

export type OtpPurpose = 'signup' | 'forgot_password' | 'change_email';

const RESEND_COOLDOWN_SECONDS = 30;
const MAX_WRONG_ATTEMPTS = 5;

export function generate6DigitOtp(): string {
  // Cryptographically secure random 6-digit number
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

export async function createAndStoreOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const cooldownKey = `otp_cooldown:${purpose}:${normalizedEmail}`;
  const otpKey = `otp:${purpose}:${normalizedEmail}`;
  const attemptsKey = `otp_attempts:${purpose}:${normalizedEmail}`;

  // Check 30s resend cooldown
  const inCooldown = await redis.exists(cooldownKey);
  if (inCooldown) {
    const ttl = await redis.ttl(cooldownKey);
    throw new TooManyRequestsError(
      `Please wait ${ttl > 0 ? ttl : RESEND_COOLDOWN_SECONDS} seconds before requesting a new code`,
      'OTP_COOLDOWN'
    );
  }

  const code = generate6DigitOtp();

  // Store OTP with configured TTL
  await redis.set(otpKey, code, 'EX', env.OTP_TTL_SECONDS);

  // Set 30s cooldown
  await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS);

  // Reset wrong attempts counter
  await redis.del(attemptsKey);

  return code;
}

export async function verifyStoredOtp(email: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const otpKey = `otp:${purpose}:${normalizedEmail}`;
  const attemptsKey = `otp_attempts:${purpose}:${normalizedEmail}`;
  const cooldownKey = `otp_cooldown:${purpose}:${normalizedEmail}`;

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

  return true;
}
