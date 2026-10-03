import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { cleanupTestUsers, createTestUser } from './test.helper';

describe('Conversations Module Integration Tests', () => {
  let user1: any;
  let user2: any;
  let convId: string;

  beforeAll(async () => {
    await cleanupTestUsers();
    user1 = await createTestUser('test_c1');
    user2 = await createTestUser('test_c2');
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('1. GET /api/v1/conversations lists user chats including Notes to Self', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', user1.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversations).toBeInstanceOf(Array);
    expect(res.body.data.conversations.length).toBeGreaterThanOrEqual(1);

    const selfChat = res.body.data.conversations.find((c: any) => c.isSelf);
    expect(selfChat).toBeDefined();
    expect(selfChat.state).toBe('isSelf');
  });

  it('2. POST /api/v1/conversations creates a pending conversation request with 1 message', async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', user1.authHeader)
      .send({
        recipientId: user2.user.id,
        message: 'Hello, this is user1!',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.conversationId).toBeDefined();
    convId = res.body.data.conversationId;
  });

  it('3. Requester cannot send a second message while request is pending (MAX_PENDING_MESSAGES = 1)', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({
        body: 'Second message should be blocked',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MAX_PENDING_MESSAGES_REACHED');
  });

  it('4. Recipient sees pending_received state, requester sees pending_sent', async () => {
    // Recipient check
    const resUser2 = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', user2.authHeader);
    expect(resUser2.status).toBe(200);
    expect(resUser2.body.data.conversation.state).toBe('pending_received');

    // Requester check
    const resUser1 = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', user1.authHeader);
    expect(resUser1.status).toBe(200);
    expect(resUser1.body.data.conversation.state).toBe('pending_sent');
  });

  it('5. POST /api/v1/conversations/:id/accept accepts the request', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/accept`)
      .set('Authorization', user2.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.status).toBe('accepted');

    // Now user1 can send further messages
    const resMsg = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({
        body: 'Glad you accepted!',
      });

    expect(resMsg.status).toBe(201);
    expect(resMsg.body.data.message.body).toBe('Glad you accepted!');
  });

  it('6. POST /api/v1/conversations/:id/seen marks messages as read', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/seen`)
      .set('Authorization', user2.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('7. POST /api/v1/conversations/:id/block blocks communication', async () => {
    // User2 blocks user1
    const resBlock = await request(app)
      .post(`/api/v1/conversations/${convId}/block`)
      .set('Authorization', user2.authHeader);
    expect(resBlock.status).toBe(200);

    // User1 attempts to message user2
    const resMsg = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'You should not receive this' });

    expect(resMsg.status).toBe(403);
    expect(resMsg.body.error.code).toBe('USER_BLOCKED');

    // User2 unblocks user1
    const resUnblock = await request(app)
      .post(`/api/v1/conversations/${convId}/unblock`)
      .set('Authorization', user2.authHeader);
    expect(resUnblock.status).toBe(200);
  });

  it('8. POST /api/v1/conversations/:id/clear clears history for current user', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convId}/clear`)
      .set('Authorization', user1.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('9. DELETE /api/v1/conversations/:id hides conversation from chat list', async () => {
    const res = await request(app)
      .delete(`/api/v1/conversations/${convId}`)
      .set('Authorization', user1.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    // Verify conversation is hidden for user1
    const resList = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', user1.authHeader);

    const hiddenInList = resList.body.data.conversations.find((c: any) => c.id === convId);
    expect(hiddenInList).toBeUndefined();
  });
});
