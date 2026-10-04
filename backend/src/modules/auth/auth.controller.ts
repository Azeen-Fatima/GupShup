import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../utils/errors';

const authService = new AuthService();

export const REFRESH_COOKIE_NAME = 'refreshToken';

export function getRefreshTokenCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? env.COOKIE_SAMESITE : 'lax') as 'lax' | 'none' | 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function getClearCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? env.COOKIE_SAMESITE : 'lax') as 'lax' | 'none' | 'strict',
    path: '/',
  };
}

export class AuthController {
  async signupCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.requestSignupCode(req.body.email);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async verifySignup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifySignupCode(req.body.email, req.body.code);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async checkUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = String(req.query.username || '');
      const result = await authService.isUsernameAvailable(username);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.completeSignup(req.body);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions());
      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        201
      );
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body.identifier, req.body.password);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions());
      sendSuccess(res, {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      if (!token) {
        throw new UnauthorizedError('Refresh token is missing', 'NO_REFRESH_TOKEN');
      }

      const result = await authService.refresh(token);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions());
      sendSuccess(res, {
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      await authService.logout(token);
      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  async forgotPasswordCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.requestForgotPasswordCode(req.body.email);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async verifyForgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifyForgotPasswordCode(req.body.email, req.body.code);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.resetPassword(req.body.resetToken, req.body.newPassword);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await authService.changePassword(
        userId,
        req.body.currentPassword,
        req.body.newPassword
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async changeEmailCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await authService.requestChangeEmailCode(userId, req.body.newEmail);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async confirmChangeEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await authService.confirmChangeEmail(
        userId,
        req.body.newEmail,
        req.body.code
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.googleAuth(req.body.idToken);
      if (result.needsProfile) {
        sendSuccess(res, {
          needsProfile: true,
          googleToken: result.googleToken,
          email: result.email,
          name: result.name,
          avatarUrl: result.avatarUrl,
        });
      } else {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken!, getRefreshTokenCookieOptions());
        sendSuccess(res, {
          needsProfile: false,
          user: result.user,
          accessToken: result.accessToken,
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async completeGoogleProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.completeGoogleProfile(req.body);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions());
      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        201
      );
    } catch (err) {
      next(err);
    }
  }
}
