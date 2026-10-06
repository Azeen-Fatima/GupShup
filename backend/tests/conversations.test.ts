import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { cleanupTestUsers, createTestUser } from './test.helper';

describe('Conversations Module Integration Tests', () => {
  let user1: any;
  let user2: any;
  let userA: any;
  let userB: any;
  let convId: string;
  let convABId: string;

  beforeAll(async () => {
    await cleanupTestUsers();
    user1 = await createTestUser('test_c1');
    user2 = await createTestUser('test_c2');
    userA = await createTestUser('test_ca');
    userB = await createTestUser('test_cb');
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

  it('Scenario 8: No attachments allowed while pending (returns 403 ATTACHMENTS_NOT_ALLOWED)', async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', user1.authHeader)
      .send({
        recipientId: user2.user.id,
        initialMessage: {
          type: 'image',
          body: 'Photo request',
          attachmentUrl: 'https://example.com/photo.jpg',
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ATTACHMENTS_NOT_ALLOWED');
  });

  it('Scenario 1: Pending limit (max 1 message, 2nd attempt returns 403 REQUEST_PENDING_LIMIT)', async () => {
    // 1st attempt: success
    const res1 = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', user1.authHeader)
      .send({
        recipientId: user2.user.id,
        message: 'Hello, this is message 1 from user1!',
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.conversationId).toBeDefined();
    convId = res1.body.data.conversationId;

    // 2nd attempt via send message returns 403 REQUEST_PENDING_LIMIT
    const res2 = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({
        body: 'Second message should be blocked',
      });

    expect(res2.status).toBe(403);
    expect(res2.body.error.code).toBe('REQUEST_PENDING_LIMIT');

    // Also verify state representation
    const resUser2 = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', user2.authHeader);
    expect(resUser2.body.data.conversation.state).toBe('pending_received');

    const resUser1 = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', user1.authHeader);
    expect(resUser1.body.data.conversation.state).toBe('pending_sent');
  });

  it('Scenario 2: 1st decline allows sender 1 extra follow-up message', async () => {
    // Recipient declines 1st time
    const resDecline = await request(app)
      .post(`/api/v1/conversations/${convId}/decline`)
      .set('Authorization', user2.authHeader);

    expect(resDecline.status).toBe(200);
    expect(resDecline.body.data.conversation.status).toBe('declined');
    expect(resDecline.body.data.conversation.declineCount).toBe(1);

    // Sender checks conversation: canSendExtraMessage is true
    const resConv = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', user1.authHeader);
    expect(resConv.body.data.conversation.canSendExtraMessage).toBe(true);

    // Sender sends 1 extra text message
    const resExtra = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Please reconsider, here is 1 follow up' });

    expect(resExtra.status).toBe(201);
    expect(resExtra.body.data.message.body).toBe('Please reconsider, here is 1 follow up');

    // Conversation moves back to pending for recipient
    const resConv2 = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', user2.authHeader);
    expect(resConv2.body.data.conversation.status).toBe('pending');
  });

  it('Scenario 3: 2nd decline locks sender with 403 REQUEST_DECLINED', async () => {
    // Recipient declines 2nd time
    const resDecline2 = await request(app)
      .post(`/api/v1/conversations/${convId}/decline`)
      .set('Authorization', user2.authHeader);

    expect(resDecline2.status).toBe(200);
    expect(resDecline2.body.data.conversation.declineCount).toBe(2);

    // Sender tries to send message -> 403 REQUEST_DECLINED
    const resLocked = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Trying again after 2nd decline' });

    expect(resLocked.status).toBe(403);
    expect(resLocked.body.error.code).toBe('REQUEST_DECLINED');
  });

  it('Scenario 6: Accept from declined sets status accepted and allows messaging', async () => {
    // Recipient accepts from Settings > Declined
    const resAccept = await request(app)
      .post(`/api/v1/conversations/${convId}/accept`)
      .set('Authorization', user2.authHeader);

    expect(resAccept.status).toBe(200);
    expect(resAccept.body.data.conversation.status).toBe('accepted');

    // Sender can now send messages
    const resMsg = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', user1.authHeader)
      .send({ body: 'Thank you for accepting!' });

    expect(resMsg.status).toBe(201);
    expect(resMsg.body.data.message.body).toBe('Thank you for accepting!');
  });

  it('Scenario 4: Silent block while pending does not leak to sender', async () => {
    // userA sends 1st message to userB
    const resInit = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', userA.authHeader)
      .send({
        recipientId: userB.user.id,
        message: 'Initial pending request from userA to userB',
      });

    expect(resInit.status).toBe(201);
    convABId = resInit.body.data.conversationId;

    // userB blocks userA while pending
    const resBlock = await request(app)
      .post(`/api/v1/conversations/${convABId}/block`)
      .set('Authorization', userB.authHeader);
    expect(resBlock.status).toBe(200);

    // userA checks conversation details: silent block
    const resUserAConv = await request(app)
      .get(`/api/v1/conversations/${convABId}`)
      .set('Authorization', userA.authHeader);
    expect(resUserAConv.body.data.conversation.state).toBe('pending_sent');
    expect(resUserAConv.body.data.conversation.isBlockedByThem).toBe(false);

    // userA sends 2nd message: rejected with normal pending limit
    const resAttempt = await request(app)
      .post(`/api/v1/conversations/${convABId}/messages`)
      .set('Authorization', userA.authHeader)
      .send({ body: 'User A follows up' });
    expect(resAttempt.status).toBe(403);
    expect(resAttempt.body.error.code).toBe('REQUEST_PENDING_LIMIT');
  });

  it('Scenario 7: Blocked user is hidden from Find People in BOTH directions', async () => {
    // userB blocked userA in previous test
    // 1. userB searches for userA -> userA is NOT returned
    const resSearchB = await request(app)
      .get(`/api/v1/users/search?q=${userA.user.username}`)
      .set('Authorization', userB.authHeader);
    expect(resSearchB.status).toBe(200);
    const foundAInB = resSearchB.body.data.users.find((u: any) => u.id === userA.user.id);
    expect(foundAInB).toBeUndefined();

    // 2. userA searches for userB -> userB is NOT returned
    const resSearchA = await request(app)
      .get(`/api/v1/users/search?q=${userB.user.username}`)
      .set('Authorization', userA.authHeader);
    expect(resSearchA.status).toBe(200);
    const foundBInA = resSearchA.body.data.users.find((u: any) => u.id === userB.user.id);
    expect(foundBInA).toBeUndefined();
  });

  it('Scenario 5: Unblock returns conversation to pending state', async () => {
    // userB unblocks userA
    const resUnblock = await request(app)
      .post(`/api/v1/conversations/${convABId}/unblock`)
      .set('Authorization', userB.authHeader);
    expect(resUnblock.status).toBe(200);

    // Verify conversation returns to pending
    const resConv = await request(app)
      .get(`/api/v1/conversations/${convABId}`)
      .set('Authorization', userB.authHeader);
    expect(resConv.body.data.conversation.status).toBe('pending');
    expect(resConv.body.data.conversation.state).toBe('pending_received');

    // Recipient can now accept
    const resAccept = await request(app)
      .post(`/api/v1/conversations/${convABId}/accept`)
      .set('Authorization', userB.authHeader);
    expect(resAccept.status).toBe(200);
    expect(resAccept.body.data.conversation.status).toBe('accepted');
  });

  it('Clear history and delete conversation', async () => {
    const resClear = await request(app)
      .post(`/api/v1/conversations/${convId}/clear`)
      .set('Authorization', user1.authHeader);
    expect(resClear.status).toBe(200);
    expect(resClear.body.data.success).toBe(true);

    const resDelete = await request(app)
      .delete(`/api/v1/conversations/${convId}`)
      .set('Authorization', user1.authHeader);
    expect(resDelete.status).toBe(200);
    expect(resDelete.body.data.success).toBe(true);
  });
});
