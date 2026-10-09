import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
}

export interface RefreshTokenPayload {
  tokenId: string;
  userId: string;
}

export interface TempActionTokenPayload {
  email: string;
  purpose: 'signup' | 'forgot_password';
  googleId?: string;
  name?: string;
  avatarUrl?: string | null;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as any,
  });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as any,
  });
}

export function generateTempToken(payload: TempActionTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired access token', 'TOKEN_EXPIRED');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired refresh token', 'REFRESH_TOKEN_EXPIRED');
  }
}

export function verifyTempToken(token: string, expectedPurpose: 'signup' | 'forgot_password'): TempActionTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TempActionTokenPayload;
    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedError('Invalid token purpose', 'INVALID_TOKEN');
    }
    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired action token', 'TOKEN_EXPIRED');
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface UnlockTokenPayload {
  userId: string;
  peerUserId?: string;
  purpose: 'chat_unlock';
}

export function generateUnlockToken(payload: { userId: string; peerUserId?: string }): string {
  return jwt.sign({ ...payload, purpose: 'chat_unlock' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
  });
}

export function verifyUnlockToken(token: string, expectedUserId: string, expectedPeerUserId?: string): boolean {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as UnlockTokenPayload;
    if (decoded.purpose !== 'chat_unlock' || decoded.userId !== expectedUserId) {
      return false;
    }
    if (expectedPeerUserId && decoded.peerUserId && decoded.peerUserId !== expectedPeerUserId) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
