import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { cleanupTestUsers, createTestUser } from './test.helper';

describe('Messages Module Integration Tests', () => {
  let user1: any;
  let user2: any;
  let convId: string;

  beforeAll(async () => {
    await cleanupTestUsers();
    user1 = await createTestUser('test_m1');
    user2 = await createTestUser('test_m2');

    // Setup an accepted conversation between user1 and user2
    const convRes = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', user1.authHeader)
      .send({
        recipientId: user2.user.id,
        message: 'Initial message for tests',
      });

    convId = convRes.body.data.conversationId;

    await request(app)
      .post(`/api/v1/conversations/${convId}/accept`)
      .set('Authorization', user2.authHeader);
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('1. POST /api/v1/conversations/:id/messages sends message', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user2.authHeader)
      .send({
        body: 'Reply message 1',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.message.body).toBe('Reply message 1');
    expect(res.body.data.message.senderId).toBe(user2.user.id);
  });

  it('2. GET /api/v1/conversations/:id/messages paginates messages', async () => {
    // Send 3 more messages
    for (let i = 2; i <= 4; i++) {
      await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', user1.authHeader)
        .send({ body: `Sequential message ${i}` });
    }

    // Fetch page of 2 messages
    const resPage1 = await request(app)
      .get(`/api/v1/conversations/${convId}/messages?limit=2`)
      .set('Authorization', user1.authHeader);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.data.messages.length).toBe(2);
    expect(resPage1.body.data.hasMore).toBe(true);
    expect(resPage1.body.data.nextCursor).toBeDefined();

    const cursor = resPage1.body.data.nextCursor;

    // Fetch next page using cursor
    const resPage2 = await request(app)
      .get(`/api/v1/conversations/${convId}/messages?limit=2&cursor=${cursor}`)
      .set('Authorization', user1.authHeader);

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.data.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('3. POST /api/v1/conversations/:id/seen marks unread messages seen', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/seen`)
      .set('Authorization', user2.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    // Verify unread count is 0 for user2
    const resConv = await request(app)
      .get(`/api/v1/conversations`)
      .set('Authorization', user2.authHeader);

    const chat = resConv.body.data.conversations.find((c: any) => c.id === convId);
    expect(chat?.unreadCount).toBe(0);
  });

  it('4. POST /api/v1/conversations/:id/messages dedupes by clientId', async () => {
    const clientId = `client_msg_${Date.now()}`;

    const res1 = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Message with clientId', clientId });

    expect(res1.status).toBe(201);
    const msgId = res1.body.data.message.id;
    expect(res1.body.data.message.clientId).toBe(clientId);

    // Resend with exact same clientId
    const res2 = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Message with clientId duplicate attempt', clientId });

    expect(res2.status).toBe(201);
    expect(res2.body.data.message.id).toBe(msgId);
    expect(res2.body.data.message.body).toBe('Message with clientId');
  });

  it('5. Verifies 3-stage message ticks: sent -> delivered -> read', async () => {
    const resSend = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Tick verification message' });

    expect(resSend.status).toBe(201);
    const msg = resSend.body.data.message;
    // Stage 1: Sent (1 grey tick)
    expect(msg.seenAt).toBeNull();
    expect(msg.deliveredAt).toBeNull();

    // Recipient marks seen -> Stage 2 & 3: Delivered + Read (2 blue ticks)
    await request(app)
      .post(`/api/v1/conversations/${convId}/seen`)
      .set('Authorization', user2.authHeader);

    const resMsgs = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader);

    const updatedMsg = resMsgs.body.data.messages.find((m: any) => m.id === msg.id);
    expect(updatedMsg).toBeDefined();
    expect(updatedMsg.seenAt).not.toBeNull();
    expect(updatedMsg.deliveredAt).not.toBeNull();
  });
});
