import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/response';

const isTest = env.NODE_ENV === 'test';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return sendError(res, 'Too many requests, please try again later.', 429, 'TOO_MANY_REQUESTS');
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return sendError(
      res,
      'Too many authentication attempts, please try again later.',
      429,
      'AUTH_RATE_LIMIT'
    );
  },
});

export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return sendError(
      res,
      'Too many OTP requests from this IP, please try again later.',
      429,
      'OTP_RATE_LIMIT'
    );
  },
});
