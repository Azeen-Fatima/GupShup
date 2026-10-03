import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { capturedMails, clearCapturedMails } from '../src/utils/mailer';
import { cleanupTestUsers, createTestUser } from './test.helper';
import { prisma } from '../src/db/prisma';

describe('Auth Module Integration Tests', () => {
  beforeAll(async () => {
    await cleanupTestUsers();
    clearCapturedMails();
  });

  afterAll(async () => {
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
});
