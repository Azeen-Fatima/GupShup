import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/prisma';
import { createTestUser, cleanupTestUsers } from './test.helper';

type TestUser = Awaited<ReturnType<typeof createTestUser>>;

describe('Web Push & Permissions Integration Tests', () => {
  let user1: TestUser;
  let user2: TestUser;
  let convId: string;

  beforeAll(async () => {
    user1 = await createTestUser('push1');
    user2 = await createTestUser('push2');
  });

  afterAll(async () => {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId: { in: [user1.user.id, user2.user.id] },
      },
    });
    await cleanupTestUsers([user1.user.id, user2.user.id]);
  });

  it('1. GET /api/v1/push/public-key returns 200 with publicKey field', async () => {
    const res = await request(app).get('/api/v1/push/public-key');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('publicKey');
  });

  it('2. POST /api/v1/push/subscribe saves push subscription for user', async () => {
    const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/fake-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/push/subscribe')
      .set('Authorization', user1.authHeader)
      .send({
        endpoint: fakeEndpoint,
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs6JLkgntWDvA',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
        userAgent: 'Mozilla/5.0 TestBrowser',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const saved = await prisma.pushSubscription.findUnique({
      where: { endpoint: fakeEndpoint },
    });
    expect(saved).not.toBeNull();
    expect(saved?.userId).toBe(user1.user.id);
  });

  it('3. DELETE /api/v1/push/unsubscribe removes subscription', async () => {
    const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/fake-${Date.now()}`;
    await prisma.pushSubscription.create({
      data: {
        userId: user1.user.id,
        endpoint: fakeEndpoint,
        p256dh: 'fake-p256dh',
        auth: 'fake-auth',
      },
    });

    const res = await request(app)
      .delete('/api/v1/push/unsubscribe')
      .set('Authorization', user1.authHeader)
      .send({ endpoint: fakeEndpoint });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await prisma.pushSubscription.findUnique({
      where: { endpoint: fakeEndpoint },
    });
    expect(check).toBeNull();
  });

  it('4. POST /conversations/:id/messages returns updated sender permissions', async () => {
    // User1 creates conversation with User2
    const resConv = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', user1.authHeader)
      .send({
        recipientId: user2.user.id,
        initialMessage: {
          body: 'Hello User 2',
          type: 'text',
        },
      });

    expect(resConv.status).toBe(201);
    convId = resConv.body.data.conversationId;

    // Check permissions for user1 (requester): should be pending limit reached
    const checkUser1Msg = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Second message' });

    expect(checkUser1Msg.status).toBe(403);
    expect(checkUser1Msg.body.error.code).toBe('REQUEST_PENDING_LIMIT');

    // User2 declines 1st time
    const resDecline = await request(app)
      .post(`/api/v1/conversations/${convId}/decline`)
      .set('Authorization', user2.authHeader);

    expect(resDecline.status).toBe(200);

    // User1 sends 1 extra message -> returns canSend: false and remainingMessages: 0
    const resExtra = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Please reconsider my request' });

    expect(resExtra.status).toBe(201);
    expect(resExtra.body.data.message.body).toBe('Please reconsider my request');
    expect(resExtra.body.data.permissions).toBeDefined();
    expect(resExtra.body.data.permissions.canSend).toBe(false);
    expect(resExtra.body.data.permissions.remainingMessages).toBe(0);

    // Further message attempt from User1 returns 403 REQUEST_DECLINED
    const resForbidden = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Another message' });

    expect(resForbidden.status).toBe(403);
    expect(resForbidden.body.error.code).toBe('REQUEST_DECLINED');
  });
});
