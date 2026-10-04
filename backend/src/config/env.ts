import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { z } from 'zod';

// Resolve backend/.env relative to the backend folder
const backendDir = path.resolve(__dirname, '../../');
const envCandidate1 = path.join(backendDir, '.env');
const envCandidate2 = path.resolve(__dirname, '../.env');
const envCandidate3 = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envCandidate1)) {
  dotenv.config({ path: envCandidate1 });
} else if (fs.existsSync(envCandidate2)) {
  dotenv.config({ path: envCandidate2 });
} else if (fs.existsSync(envCandidate3)) {
  dotenv.config({ path: envCandidate3 });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().default('http://localhost:4200'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('no-reply@gupshup.chat'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  OTP_TTL_SECONDS: z.coerce.number().default(900),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingKeys = parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean);
  const formatted = missingKeys.join(', ');
  throw new Error(
    `[Startup Error] Missing or invalid required environment variable(s): ${formatted}. Please check backend/.env.`
  );
}

export const env = parsed.data;

export const allowedOrigins = env.CLIENT_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
