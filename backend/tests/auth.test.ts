import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { capturedMails, clearCapturedMails } from '../src/utils/mailer';
import { cleanupTestUsers, createTestUser } from './test.helper';
import { prisma } from '../src/db/prisma';

import { env } from '../src/config/env';

describe('Auth Module Integration Tests', () => {
  const originalFetch = global.fetch;
  const originalResendApiKey = env.RESEND_API_KEY;

  beforeAll(async () => {
    env.RESEND_API_KEY = 're_test_mock_auth';
    await cleanupTestUsers();
    clearCapturedMails();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'mock_auth_email' }),
      text: async () => JSON.stringify({ id: 'mock_auth_email' }),
    });
  });

  beforeEach(() => {
    env.RESEND_API_KEY = 're_test_mock_auth';
  });

  afterAll(async () => {
    env.RESEND_API_KEY = originalResendApiKey;
    global.fetch = originalFetch;
    await cleanupTestUsers();
  });

  const testEmail = `test_auth_${Date.now()}@example.com`;
  const testUsername = `test_user_${Date.now().toString().slice(-6)}`;
  let signupToken: string;
  let refreshTokenCookie: string;
  let accessToken: string;

  it('1. POST /api/v1/auth/signup/code sends OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup/code')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const mail = capturedMails.find((m) => m.to === testEmail);
    expect(mail).toBeDefined();
    expect(mail?.code).toBeDefined();
    expect(mail?.code?.length).toBe(6);
  });

  it('1b. POST /api/v1/auth/signup/code returns 429 when requesting within cooldown period', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup/code')
      .send({ email: testEmail });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('OTP_COOLDOWN');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('2. POST /api/v1/auth/signup/verify verifies code and issues signupToken', async () => {
    const mail = capturedMails.find((m) => m.to === testEmail);
    const code = mail!.code!;

    const res = await request(app)
      .post('/api/v1/auth/signup/verify')
      .send({ email: testEmail, code });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.signupToken).toBeDefined();
    signupToken = res.body.data.signupToken;
  });

  it('3. GET /api/v1/auth/signup/username checks username availability', async () => {
    const res = await request(app)
      .get(`/api/v1/auth/signup/username?username=${testUsername}`);

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
  });

  it('4. POST /api/v1/auth/signup completes registration and creates self chat', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        signupToken,
        name: 'Test Fullname',
        username: testUsername,
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.username).toBe(testUsername);
    expect(res.body.data.accessToken).toBeDefined();

    accessToken = res.body.data.accessToken;

    // Check refresh cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.find((c) => c.includes('refreshToken=')) : cookies;
    expect(cookieHeader).toBeDefined();
    refreshTokenCookie = cookieHeader!;

    // Check notes to self conversation was created
    const user = res.body.data.user;
    const selfConv = await prisma.conversation.findFirst({
      where: { userAId: user.id, userBId: user.id },
    });
    expect(selfConv).toBeDefined();
    expect(selfConv?.status).toBe('accepted');
  });

  it('5. POST /api/v1/auth/login logs in with email or username', async () => {
    // Login with email
    const resEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: testEmail,
        password: 'Password123!',
      });

    expect(resEmail.status).toBe(200);
    expect(resEmail.body.data.accessToken).toBeDefined();

    // Login with username
    const resUsername = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: testUsername,
        password: 'Password123!',
      });

    expect(resUsername.status).toBe(200);
    expect(resUsername.body.data.accessToken).toBeDefined();

    // Wrong password returns 401
    const resWrong = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: testEmail,
        password: 'WrongPassword!',
      });

    expect(resWrong.status).toBe(401);
  });

  it('6. POST /api/v1/auth/refresh rotates refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    const newCookies = res.headers['set-cookie'];
    expect(newCookies).toBeDefined();
  });

  it('7. Forgot password flow', async () => {
    clearCapturedMails();

    // Request reset code
    const resReq = await request(app)
      .post('/api/v1/auth/forgot-password/code')
      .send({ email: testEmail });
    expect(resReq.status).toBe(200);

    const mail = capturedMails.find((m) => m.to === testEmail);
    expect(mail?.code).toBeDefined();

    // Verify code
    const resVer = await request(app)
      .post('/api/v1/auth/forgot-password/verify')
      .send({ email: testEmail, code: mail!.code! });
    expect(resVer.status).toBe(200);
    const resetToken = resVer.body.data.resetToken;

    // Reset password
    const resReset = await request(app)
      .post('/api/v1/auth/forgot-password/reset')
      .send({ resetToken, newPassword: 'NewPassword123!' });
    expect(resReset.status).toBe(200);

    // Login with new password
    const resLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testEmail, password: 'NewPassword123!' });
    expect(resLogin.status).toBe(200);
  });

  it('8. POST /api/v1/auth/logout clears refresh cookie and revokes session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshTokenCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('9. POST /api/v1/auth/login on Google-only account returns GOOGLE_ACCOUNT_ONLY', async () => {
    const googleUserEmail = `google_only_${Date.now()}@example.com`;
    await prisma.user.create({
      data: {
        email: googleUserEmail,
        username: `google_user_${Date.now().toString().slice(-5)}`,
        name: 'Google Only User',
        googleId: `gid_${Date.now()}`,
        passwordHash: null,
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: googleUserEmail, password: 'AnyPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GOOGLE_ACCOUNT_ONLY');
    expect(res.body.error.message).toBe('This account uses Google sign-in. Please use Continue with Google.');
  });

  it('10. Rejects change-password and change-email for Google-only accounts', async () => {
    const googleUser = await prisma.user.create({
      data: {
        email: `google_change_${Date.now()}@example.com`,
        username: `guser_${Date.now().toString().slice(-5)}`,
        name: 'Google Test User',
        googleId: `gid_${Date.now()}`,
        passwordHash: null,
      },
    });

    const googleToken = (await import('../src/utils/token')).generateAccessToken({
      userId: googleUser.id,
      email: googleUser.email,
      username: googleUser.username,
    });

    const passRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${googleToken}`)
      .send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' });

    expect(passRes.status).toBe(400);
    expect(passRes.body.error.code).toBe('NO_LOCAL_PASSWORD');

    const emailRes = await request(app)
      .post('/api/v1/auth/change-email/code')
      .set('Authorization', `Bearer ${googleToken}`)
      .send({ newEmail: 'newemail@example.com' });

    expect(emailRes.status).toBe(400);
    expect(emailRes.body.error.code).toBe('GOOGLE_ACCOUNT_EMAIL_IMMUTABLE');
  });
});
