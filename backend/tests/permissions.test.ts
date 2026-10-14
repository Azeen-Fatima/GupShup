import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/prisma';
import { createTestUser, cleanupTestUsers } from './test.helper';
import { messagesService } from '../src/modules/messages/messages.service';

type TestUser = Awaited<ReturnType<typeof createTestUser>>;

describe('Permissions & Decline Flow Integration Tests', () => {
  let sender: TestUser;
  let receiver: TestUser;
  let convId: string;
  let selfConvId: string;

  beforeAll(async () => {
    sender = await createTestUser('perms1');
    receiver = await createTestUser('perms2');

    // Notes to Self conversation
    const selfRes = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', sender.authHeader)
      .send({ recipientId: sender.user.id, message: 'Self note' });
    selfConvId = selfRes.body.data.conversationId;
  });

  afterAll(async () => {
    if (convId) {
      await prisma.message.deleteMany({ where: { conversationId: convId } });
      await prisma.conversationMember.deleteMany({ where: { conversationId: convId } });
      await prisma.conversation.deleteMany({ where: { id: convId } });
    }
    if (selfConvId) {
      await prisma.message.deleteMany({ where: { conversationId: selfConvId } });
      await prisma.conversationMember.deleteMany({ where: { conversationId: selfConvId } });
      await prisma.conversation.deleteMany({ where: { id: selfConvId } });
    }
    await cleanupTestUsers([sender.user.id, receiver.user.id]);
  });

  it('1. Notes to Self chat returns canSend true with 999 messages', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${selfConvId}`)
      .set('Authorization', sender.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.permissions).toEqual({
      canSend: true,
      reason: null,
      remainingMessages: 999,
    });
  });

  it('2. New pending chat before message sent returns canSend true for sender', async () => {
    // Create pending conversation without message directly
    const [uA, uB] = sender.user.id < receiver.user.id ? [sender.user.id, receiver.user.id] : [receiver.user.id, sender.user.id];
    const created = await prisma.conversation.create({
      data: {
        userAId: uA,
        userBId: uB,
        requesterId: sender.user.id,
        status: 'pending',
      },
    });
    convId = created.id;
    await prisma.conversationMember.createMany({
      data: [
        { conversationId: convId, userId: sender.user.id },
        { conversationId: convId, userId: receiver.user.id },
      ],
    });

    const perms = await messagesService.getSenderPermissions(convId, sender.user.id);
    expect(perms.canSend).toBe(true);
    expect(perms.remainingMessages).toBe(1);
    expect(perms.reason).toBeNull();
  });

  it('3. Pending chat after sender uses 1 message returns canSend false and REQUEST_PENDING_LIMIT', async () => {
    // Sender sends first message
    await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', sender.authHeader)
      .send({ body: 'Hello receiver' });

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', sender.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.permissions).toEqual({
      canSend: false,
      reason: 'REQUEST_PENDING_LIMIT',
      remainingMessages: 0,
    });
  });

  it('4. After 1st decline, sender has canSend true, REQUEST_DECLINED_EXTRA, remainingMessages 1', async () => {
    // Receiver declines
    const declineRes = await request(app)
      .post(`/api/v1/conversations/${convId}/decline`)
      .set('Authorization', receiver.authHeader);

    expect(declineRes.status).toBe(200);

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', sender.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.permissions).toEqual({
      canSend: true,
      reason: 'REQUEST_DECLINED_EXTRA',
      remainingMessages: 1,
    });
  });

  it('5. After sender uses 1 extra message, returns canSend false, REQUEST_DECLINED, remainingMessages 0', async () => {
    // Sender sends 1 extra follow-up message
    const sendRes = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', sender.authHeader)
      .send({ body: 'Just one follow up please' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.permissions).toEqual({
      canSend: false,
      reason: 'REQUEST_DECLINED',
      remainingMessages: 0,
    });

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', sender.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.permissions).toEqual({
      canSend: false,
      reason: 'REQUEST_DECLINED',
      remainingMessages: 0,
    });
  });

  it('6. Accepting conversation resets declineCount and returns canSend true with 999 messages', async () => {
    // Receiver accepts
    const acceptRes = await request(app)
      .post(`/api/v1/conversations/${convId}/accept`)
      .set('Authorization', receiver.authHeader);

    expect(acceptRes.status).toBe(200);

    const res = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set('Authorization', sender.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.permissions).toEqual({
      canSend: true,
      reason: null,
      remainingMessages: 999,
    });
    expect(res.body.data.conversation.declineCount).toBe(0);
  });
});
