import bcrypt from 'bcrypt';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import {
  BadRequestError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../utils/errors';
import { generateUnlockToken } from '../../utils/token';
import { ResetPinInput } from './chatLock.schemas';
import { OAuth2Client } from 'google-auth-library';

interface FailedAttemptRecord {
  count: number;
  lockUntil?: number;
}

const failedPinAttempts = new Map<string, FailedAttemptRecord>();

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client | null {
  if (googleClient) return googleClient;
  if (env.GOOGLE_CLIENT_ID) {
    googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

export class ChatLockService {
  /**
   * Get user chat lock status and list of locked contact user IDs
   */
  async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chatLockPinHash: true },
    });

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const locks = await prisma.chatLock.findMany({
      where: { userId },
      select: { peerUserId: true },
    });

    return {
      hasPin: Boolean(user.chatLockPinHash),
      lockedPeerIds: locks.map((l) => l.peerUserId),
    };
  }

  /**
   * Set 4-digit PIN for first time or update PIN
   */
  async setPin(userId: string, pin: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chatLockPinHash: true },
    });

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const hash = await bcrypt.hash(pin, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { chatLockPinHash: hash },
    });

    failedPinAttempts.delete(userId);
    return { success: true };
  }

  /**
   * Verify 4-digit PIN and generate a 5-minute unlock token
   */
  async verifyPin(userId: string, pin: string, peerUserId?: string, conversationId?: string) {
    // Check rate limiter
    const record = failedPinAttempts.get(userId);
    if (record?.lockUntil && Date.now() < record.lockUntil) {
      const remainingSeconds = Math.ceil((record.lockUntil - Date.now()) / 1000);
      throw new TooManyRequestsError(
        'Too many incorrect PIN attempts. Please try again in 5 minutes.',
        'PIN_RATE_LIMITED',
        null,
        remainingSeconds
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chatLockPinHash: true },
    });

    if (!user || !user.chatLockPinHash) {
      throw new BadRequestError('Chat lock PIN is not set. Please set a PIN first.', 'PIN_NOT_SET');
    }

    const isMatch = await bcrypt.compare(pin, user.chatLockPinHash);
    if (!isMatch) {
      const current = failedPinAttempts.get(userId) || { count: 0 };
      const newCount = current.count + 1;

      if (newCount >= 5) {
        failedPinAttempts.set(userId, {
          count: 0,
          lockUntil: Date.now() + 5 * 60 * 1000,
        });
        throw new TooManyRequestsError(
          'Too many incorrect PIN attempts. Please try again in 5 minutes.',
          'PIN_RATE_LIMITED',
          null,
          300
        );
      } else {
        failedPinAttempts.set(userId, { count: newCount });
        throw new UnauthorizedError('Incorrect PIN', 'INVALID_PIN', {
          remainingAttempts: 5 - newCount,
        });
      }
    }

    // PIN is correct - clear failed attempts
    failedPinAttempts.delete(userId);

    const unlockToken = generateUnlockToken({
      userId,
      peerUserId,
    });

    return {
      success: true,
      unlockToken,
    };
  }

  /**
   * Lock or unlock a contact for current user
   */
  async toggleLock(userId: string, peerUserId: string, locked?: boolean) {
    if (userId === peerUserId) {
      throw new BadRequestError('Cannot lock notes to self chat', 'CANNOT_LOCK_SELF');
    }

    const peer = await prisma.user.findUnique({
      where: { id: peerUserId },
      select: { id: true },
    });

    if (!peer) {
      throw new NotFoundError('Contact user not found', 'USER_NOT_FOUND');
    }

    const existing = await prisma.chatLock.findUnique({
      where: {
        userId_peerUserId: { userId, peerUserId },
      },
    });

    if (locked !== undefined) {
      if (locked && !existing) {
        await prisma.chatLock.create({
          data: { userId, peerUserId },
        });
        return { locked: true };
      }
      if (!locked && existing) {
        await prisma.chatLock.delete({
          where: { id: existing.id },
        });
        return { locked: false };
      }
      return { locked: Boolean(existing) };
    }

    // Toggle
    if (existing) {
      await prisma.chatLock.delete({
        where: { id: existing.id },
      });
      return { locked: false };
    } else {
      await prisma.chatLock.create({
        data: { userId, peerUserId },
      });
      return { locked: true };
    }
  }

  /**
   * Reset PIN by re-authenticating account (password or Google)
   */
  async resetPin(userId: string, data: ResetPinInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (user.passwordHash) {
      if (!data.password) {
        throw new BadRequestError('Account password is required to reset PIN', 'PASSWORD_REQUIRED');
      }
      const isMatch = await bcrypt.compare(data.password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedError('Incorrect account password', 'INVALID_PASSWORD');
      }
    } else if (user.googleId) {
      if (!data.idToken) {
        throw new BadRequestError('Google verification is required to reset PIN', 'GOOGLE_AUTH_REQUIRED');
      }
      const client = getGoogleClient();
      if (!client || !env.GOOGLE_CLIENT_ID) {
        throw new BadRequestError('Google verification not available', 'GOOGLE_NOT_CONFIGURED');
      }
      const ticket = await client.verifyIdToken({
        idToken: data.idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || payload.sub !== user.googleId) {
        throw new UnauthorizedError('Google verification failed', 'INVALID_GOOGLE_TOKEN');
      }
    } else {
      throw new BadRequestError('Unable to verify account credentials', 'CREDENTIALS_FAILED');
    }

    const hash = await bcrypt.hash(data.newPin, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { chatLockPinHash: hash },
    });

    failedPinAttempts.delete(userId);
    return { success: true };
  }

  /**
   * Check if a peer contact is locked for a user
   */
  async isPeerLocked(userId: string, peerUserId: string): Promise<boolean> {
    const lock = await prisma.chatLock.findUnique({
      where: {
        userId_peerUserId: { userId, peerUserId },
      },
    });
    return Boolean(lock);
  }
}

export const chatLockService = new ChatLockService();
