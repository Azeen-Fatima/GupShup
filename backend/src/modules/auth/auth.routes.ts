import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimit';
import {
  changePasswordSchema,
  completeGoogleProfileSchema,
  completeSignupSchema,
  confirmChangeEmailSchema,
  googleAuthSchema,
  loginSchema,
  requestChangeEmailSchema,
  requestForgotPasswordSchema,
  requestSignupCodeSchema,
  resetPasswordSchema,
  usernameQuerySchema,
  verifyForgotPasswordSchema,
  verifySignupCodeSchema,
} from './auth.schemas';

const router = Router();
const controller = new AuthController();

// Signup
router.post('/signup/code', otpRateLimiter, validate(requestSignupCodeSchema), controller.signupCode);
router.post('/signup/verify', validate(verifySignupCodeSchema), controller.verifySignup);
router.get('/signup/username', validate(usernameQuerySchema, 'query'), controller.checkUsername);
router.post('/signup', authRateLimiter, validate(completeSignupSchema), controller.signup);

// Login, Refresh, Logout
router.post('/login', authRateLimiter, validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

// Forgot Password
router.post('/forgot-password/code', otpRateLimiter, validate(requestForgotPasswordSchema), controller.forgotPasswordCode);
router.post('/forgot-password/verify', validate(verifyForgotPasswordSchema), controller.verifyForgotPassword);
router.post('/forgot-password/reset', validate(resetPasswordSchema), controller.resetPassword);

// Profile security (requires authenticated user)
router.post('/change-password', requireAuth, validate(changePasswordSchema), controller.changePassword);
router.post('/change-email/code', requireAuth, otpRateLimiter, validate(requestChangeEmailSchema), controller.changeEmailCode);
router.post('/change-email/confirm', requireAuth, validate(confirmChangeEmailSchema), controller.confirmChangeEmail);

// Google OAuth
router.post('/google', authRateLimiter, validate(googleAuthSchema), controller.googleAuth);
router.post('/google/complete', authRateLimiter, validate(completeGoogleProfileSchema), controller.completeGoogleProfile);

export default router;
