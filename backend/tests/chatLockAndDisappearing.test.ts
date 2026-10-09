import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/prisma';
import { cleanupExpiredMessages } from '../src/services/messageCleanup.service';

import { createTestUser } from './test.helper';

describe('Chat Lock, Disappearing Messages, and Soft Delete Integration Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let userBName: string;
  let convId: string;

  beforeAll(async () => {
    const userA = await createTestUser('test_cla');
    userAToken = userA.accessToken;
    userAId = userA.user.id;

    const userB = await createTestUser('test_clb');
    userBToken = userB.accessToken;
    userBId = userB.user.id;
    userBName = userB.user.name;

    // User A sends request to User B
    const createRes = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientId: userBId,
        message: 'Initial connection message',
      });
    convId = createRes.body.data.conversationId;

    // User B accepts request
    await request(app)
      .post(`/api/v1/conversations/${convId}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);
  });

  describe('1. Soft Delete & Find People Reopening', () => {
    it('deleting an accepted chat soft-deletes (sets hiddenAt & clearedAt, keeps status accepted)', async () => {
      // User A deletes conversation
      const delRes = await request(app)
        .delete(`/api/v1/conversations/${convId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(delRes.status).toBe(200);

      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
        include: { members: true },
      });
      expect(conv?.status).toBe('accepted');
      expect(conv?.wasAccepted).toBe(true);

      const memberA = conv?.members.find((m) => m.userId === userAId);
      expect(memberA?.hiddenAt).not.toBeNull();
      expect(memberA?.clearedAt).not.toBeNull();
    });

    it('soft-deleted contact appears in Find People for User A with conversationId', async () => {
      const searchRes = await request(app)
        .get(`/api/v1/users/search?q=${encodeURIComponent(userBName)}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(searchRes.status).toBe(200);
      const userBMatch = searchRes.body.data.users.find((u: any) => u.id === userBId);
      expect(userBMatch).toBeDefined();
      expect(userBMatch.conversationId).toBe(convId);
      expect(userBMatch.relationshipStatus).toBe('accepted');
    });

    it('messaging reopened contact continues accepted conversation without pending flow', async () => {
      const msgRes = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipientId: userBId,
          message: 'Reopened message after soft delete',
        });
      expect(msgRes.status).toBe(201);
      expect(msgRes.body.data.conversationId).toBe(convId);

      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
        include: { members: true },
      });
      expect(conv?.status).toBe('accepted');
      const memberA = conv?.members.find((m) => m.userId === userAId);
      expect(memberA?.hiddenAt).toBeNull();
    });
  });

  describe('2. Disappearing Messages', () => {
    it('sets disappearing mode to 24h and generates a system message', async () => {
      const setRes = await request(app)
        .patch(`/api/v1/conversations/${convId}/disappearing`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ mode: '24h' });
      expect(setRes.status).toBe(200);
      expect(setRes.body.data.disappearingMode).toBe('24h');
      expect(setRes.body.data.message.type).toBe('system');
      expect(setRes.body.data.message.body).toContain('turned on disappearing messages: 24 hours');
    });

    it('new message created with 24h mode has expiresAt roughly 24 hours in the future', async () => {
      const msgRes = await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ body: 'Disappearing text message' });
      expect(msgRes.status).toBe(201);
      expect(msgRes.body.data.message.expiresAt).toBeDefined();
      const expiresAt = new Date(msgRes.body.data.message.expiresAt).getTime();
      const expected = Date.now() + 24 * 60 * 60 * 1000;
      expect(Math.abs(expiresAt - expected)).toBeLessThan(60000);
    });

    it('filters out expired messages on read and cleanup job cleans them up', async () => {
      // Create an already-expired message directly in database
      const expiredMsg = await prisma.message.create({
        data: {
          conversationId: convId,
          senderId: userAToken ? userAId : userBId,
          body: 'Already expired message',
          expiresAt: new Date(Date.now() - 10000),
        },
      });

      // GET /messages must not return the expired message
      const getRes = await request(app)
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(getRes.status).toBe(200);
      const found = getRes.body.data.messages.some((m: any) => m.id === expiredMsg.id);
      expect(found).toBe(false);

      // Run cleanup job
      const cleaned = await cleanupExpiredMessages();
      expect(cleaned).toBeGreaterThanOrEqual(1);

      const checkInDb = await prisma.message.findUnique({
        where: { id: expiredMsg.id },
      });
      expect(checkInDb).toBeNull();
    });
  });

  describe('3. Chat Lock', () => {
    it('sets PIN, locks User B for User A, and enforces unlock token on message fetch', async () => {
      // User A sets 4-digit PIN
      const setPinRes = await request(app)
        .post('/api/v1/chat-lock/pin')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ pin: '1234' });
      expect(setPinRes.status).toBe(200);

      // User A locks User B
      const toggleRes = await request(app)
        .post('/api/v1/chat-lock/toggle')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ peerUserId: userBId, locked: true });
      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.locked).toBe(true);

      // GET /conversations indicates isLocked: true and masks lastMessage
      const convsRes = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(convsRes.status).toBe(200);
      const lockedConv = convsRes.body.data.conversations.find((c: any) => c.id === convId);
      expect(lockedConv.isLocked).toBe(true);
      expect(lockedConv.lastMessage.body).toBe('Locked chat');

      // User A fetches messages without unlock token -> 403 CHAT_LOCKED
      const fetchWithoutToken = await request(app)
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(fetchWithoutToken.status).toBe(403);
      expect(fetchWithoutToken.body.error.code).toBe('CHAT_LOCKED');

      // User A enters correct PIN -> receives unlock token
      const verifyRes = await request(app)
        .post('/api/v1/chat-lock/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ pin: '1234', peerUserId: userBId });
      expect(verifyRes.status).toBe(200);
      const unlockToken = verifyRes.body.data.unlockToken;
      expect(unlockToken).toBeDefined();

      // User A fetches messages with X-Unlock-Token header -> 200 OK
      const fetchWithToken = await request(app)
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('X-Unlock-Token', unlockToken);
      expect(fetchWithToken.status).toBe(200);
      expect(Array.isArray(fetchWithToken.body.data.messages)).toBe(true);
    });

    it('locks out after 5 consecutive failed PIN attempts (429 PIN_RATE_LIMITED)', async () => {
      // 4 wrong attempts return 401
      for (let i = 0; i < 4; i++) {
        const wrongRes = await request(app)
          .post('/api/v1/chat-lock/verify')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ pin: '9999', peerUserId: userBId });
        expect(wrongRes.status).toBe(401);
      }

      // 5th wrong attempt triggers 429 lockout
      const fifthWrong = await request(app)
        .post('/api/v1/chat-lock/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ pin: '9999', peerUserId: userBId });
      expect(fifthWrong.status).toBe(429);
      expect(fifthWrong.body.error.code).toBe('PIN_RATE_LIMITED');
    });
  });
});
