import { z } from 'zod';

export const usernameRegex = /^[a-z0-9._]{3,20}$/;

export const requestSignupCodeSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const verifySignupCodeSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  code: z.string().length(6, 'Verification code must be 6 digits').trim(),
});

export const completeSignupSchema = z.object({
  signupToken: z.string().min(1, 'Signup token is required'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(usernameRegex, 'Username must be 3-20 characters and contain only lowercase letters, numbers, dots, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const usernameAvailableSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(usernameRegex, 'Username must be 3-20 characters and contain only lowercase letters, numbers, dots, and underscores'),
});
export const usernameQuerySchema = usernameAvailableSchema;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  idToken: z.string().trim().min(1, 'Google idToken is required'),
});

export const googleCompleteProfileSchema = z.object({
  googleToken: z.string().trim().min(1, 'Google registration token is required'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(usernameRegex, 'Username must be 3-20 characters and contain only lowercase letters, numbers, dots, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});
export const completeGoogleProfileSchema = googleCompleteProfileSchema;

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});
export const requestForgotPasswordSchema = forgotPasswordRequestSchema;

export const forgotPasswordVerifySchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  code: z.string().length(6, 'Verification code must be 6 digits').trim(),
});
export const verifyForgotPasswordSchema = forgotPasswordVerifySchema;

export const forgotPasswordResetSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
export const resetPasswordSchema = forgotPasswordResetSchema;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const changeEmailRequestSchema = z.object({
  newEmail: z.string().email('Invalid email address').toLowerCase().trim(),
});
export const requestChangeEmailSchema = changeEmailRequestSchema;

export const changeEmailConfirmSchema = z.object({
  newEmail: z.string().email('Invalid email address').toLowerCase().trim(),
  code: z.string().length(6, 'Verification code must be 6 digits').trim(),
});
export const confirmChangeEmailSchema = changeEmailConfirmSchema;
