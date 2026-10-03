import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../utils/errors';
import {
  createAndStoreOtp,
  verifyStoredOtp,
} from '../../utils/otp';
import { sendOtpEmail } from '../../utils/mailer';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTempToken,
  hashToken,
  verifyRefreshToken,
  verifyTempToken,
} from '../../utils/token';

const BCRYPT_SALT_ROUNDS = 12;

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client | null {
  if (googleClient) return googleClient;
  if (env.GOOGLE_CLIENT_ID) {
    googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

export class AuthService {
  /**
   * Request signup verification code
   */
  async requestSignupCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const code = await createAndStoreOtp(normalizedEmail, 'signup');
    await sendOtpEmail(normalizedEmail, code, 'creating your Gupshup account');

    return { message: 'Verification code sent to your email.' };
  }

  /**
   * Verify signup code and return signupToken
   */
  async verifySignupCode(email: string, code: string): Promise<{ signupToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    await verifyStoredOtp(normalizedEmail, 'signup', code);

    const signupToken = generateTempToken({
      email: normalizedEmail,
      purpose: 'signup',
    });

    return { signupToken };
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<{ available: boolean; username: string }> {
    const normalized = username.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { username: normalized },
    });

    return {
      available: !existing,
      username: normalized,
    };
  }

  /**
   * Complete signup: create user, notes-to-self conversation, tokens
   */
  async completeSignup(data: {
    signupToken: string;
    name: string;
    username: string;
    password: string;
  }): Promise<{
    user: { id: string; email: string; username: string; name: string; avatarUrl: string | null };
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = verifyTempToken(data.signupToken, 'signup');
    const normalizedEmail = payload.email.toLowerCase().trim();
    const normalizedUsername = data.username.toLowerCase().trim();

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    if (existingUsername) {
      throw new ConflictError('Username is already taken', 'USERNAME_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    // Create user and notes-to-self conversation in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          name: data.name.trim(),
          passwordHash,
        },
      });

      // Create "Notes to Self" conversation (userAId === userBId)
      const selfConv = await tx.conversation.create({
        data: {
          userAId: newUser.id,
          userBId: newUser.id,
          requesterId: newUser.id,
          status: 'accepted',
        },
      });

      await tx.conversationMember.create({
        data: {
          conversationId: selfConv.id,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    // Create refresh token record
    const { accessToken, refreshToken } = await this.issueTokens(user.id, user.email, user.username);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login with email or username
   */
  async login(identifier: string, password: string): Promise<{
    user: { id: string; email: string; username: string; name: string; avatarUrl: string | null };
    accessToken: string;
    refreshToken: string;
  }> {
    const normalized = identifier.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalized }, { username: normalized }],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email/username or password', 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email/username or password', 'INVALID_CREDENTIALS');
    }

    const { accessToken, refreshToken } = await this.issueTokens(user.id, user.email, user.username);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotate refresh token and issue new access token
   */
  async refresh(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = verifyRefreshToken(rawRefreshToken);
    const rawHash = hashToken(rawRefreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: true },
    });

    if (!storedToken || storedToken.tokenHash !== rawHash || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      // Possible token reuse or revoked token: revoke token if it existed
      if (storedToken && !storedToken.revokedAt) {
        await prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedError('Invalid or expired refresh token', 'REVOKED_REFRESH_TOKEN');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair
    return this.issueTokens(storedToken.user.id, storedToken.user.email, storedToken.user.username);
  }

  /**
   * Revoke refresh token on logout
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    try {
      const payload = verifyRefreshToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { id: payload.tokenId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Best-effort logout: ignore verification errors
    }
  }

  /**
   * Forgot password: request code (never reveal whether email exists)
   */
  async requestForgotPasswordCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const code = await createAndStoreOtp(normalizedEmail, 'forgot_password');
      await sendOtpEmail(normalizedEmail, code, 'resetting your Gupshup password');
    }

    return {
      message: 'If an account exists with this email, a verification code has been sent.',
    };
  }

  /**
   * Forgot password: verify code and issue resetToken
   */
  async verifyForgotPasswordCode(email: string, code: string): Promise<{ resetToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    await verifyStoredOtp(normalizedEmail, 'forgot_password', code);

    const resetToken = generateTempToken({
      email: normalizedEmail,
      purpose: 'forgot_password',
    });

    return { resetToken };
  }

  /**
   * Reset password and revoke all active refresh tokens
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    const payload = verifyTempToken(resetToken, 'forgot_password');
    const normalizedEmail = payload.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundError('User account not found', 'USER_NOT_FOUND');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Revoke all refresh tokens for security
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been successfully reset. Please log in with your new password.' };
  }

  /**
   * Change password for logged-in user
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new BadRequestError('User does not have a local password set.', 'NO_LOCAL_PASSWORD');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated successfully.' };
  }

  /**
   * Change email: request verification code for new email
   */
  async requestChangeEmailCode(userId: string, newEmail: string): Promise<{ message: string }> {
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedNewEmail },
    });

    if (existingUser) {
      throw new ConflictError('This email is already in use by another account', 'EMAIL_TAKEN');
    }

    const code = await createAndStoreOtp(normalizedNewEmail, 'change_email');
    await sendOtpEmail(normalizedNewEmail, code, 'updating your Gupshup email address');

    return { message: `Verification code sent to ${normalizedNewEmail}` };
  }

  /**
   * Change email: confirm code and update email
   */
  async confirmChangeEmail(
    userId: string,
    newEmail: string,
    code: string
  ): Promise<{ user: { id: string; email: string; username: string } }> {
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedNewEmail },
    });
    if (existingUser) {
      throw new ConflictError('This email is already in use by another account', 'EMAIL_TAKEN');
    }

    await verifyStoredOtp(normalizedNewEmail, 'change_email', code);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { email: normalizedNewEmail },
      select: { id: true, email: true, username: true },
    });

    return { user: updatedUser };
  }

  /**
   * Google OAuth verification
   */
  async googleAuth(idToken: string): Promise<{
    needsProfile: boolean;
    googleToken?: string;
    user?: { id: string; email: string; username: string; name: string; avatarUrl: string | null };
    accessToken?: string;
    refreshToken?: string;
  }> {
    const client = getGoogleClient();
    if (!client || !env.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableError('Google authentication is not configured on this server.', 'GOOGLE_NOT_CONFIGURED');
    }

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
    } catch (err: any) {
      throw new UnauthorizedError('Invalid Google ID token', 'INVALID_GOOGLE_TOKEN');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedError('Google token does not contain a valid email', 'INVALID_GOOGLE_PAYLOAD');
    }

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name || 'Gupshup User';
    const avatarUrl = payload.picture || null;

    // Check if user already exists with this googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // Link googleId if user registered with email previously
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatarUrl: user.avatarUrl || avatarUrl },
        });
      }

      const tokens = await this.issueTokens(user.id, user.email, user.username);
      return {
        needsProfile: false,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    // New Google user needs profile setup (choose unique username)
    const googleToken = generateTempToken({
      email,
      purpose: 'signup',
    });

    return {
      needsProfile: true,
      googleToken,
    };
  }

  /**
   * Complete Google registration with profile details
   */
  async completeGoogleProfile(data: {
    googleToken: string;
    name: string;
    username: string;
    password?: string;
  }): Promise<{
    user: { id: string; email: string; username: string; name: string; avatarUrl: string | null };
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = verifyTempToken(data.googleToken, 'signup');
    const normalizedEmail = payload.email.toLowerCase().trim();
    const normalizedUsername = data.username.toLowerCase().trim();

    const existingUsername = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    if (existingUsername) {
      throw new ConflictError('Username is already taken', 'USERNAME_ALREADY_EXISTS');
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS) : null;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          name: data.name.trim(),
          passwordHash,
        },
      });

      // Create "Notes to Self" conversation
      const selfConv = await tx.conversation.create({
        data: {
          userAId: newUser.id,
          userBId: newUser.id,
          requesterId: newUser.id,
          status: 'accepted',
        },
      });

      await tx.conversationMember.create({
        data: {
          conversationId: selfConv.id,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    const tokens = await this.issueTokens(user.id, user.email, user.username);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Helper to issue access & refresh token pair and persist refresh token hash
   */
  private async issueTokens(
    userId: string,
    email: string,
    username: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenId = crypto.randomUUID();

    const accessToken = generateAccessToken({ userId, email, username });
    const refreshToken = generateRefreshToken({ tokenId, userId });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
