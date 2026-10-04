import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { app } from '../src/app';
import { initSocketServer } from '../src/sockets';
import { createTestUser, cleanupTestUsers } from './test.helper';
import { presenceService } from '../src/modules/presence/presence.service';
import { prisma } from '../src/db/prisma';

describe('Socket.io Integration Tests', () => {
  let server: http.Server;
  let serverPort: number;
  let user: any;
  let userB: any;
  let clientSocket: ClientSocket;
  let clientSocketB: ClientSocket;
  let conversationId: string;

  beforeAll(async () => {
    await cleanupTestUsers();
    user = await createTestUser('test_ws');
    userB = await createTestUser('test_ws_b');

    // Create a direct conversation between user and userB
    const conv = await prisma.conversation.create({
      data: {
        userAId: user.user.id,
        userBId: userB.user.id,
        requesterId: user.user.id,
        status: 'accepted',
        members: {
          create: [
            { userId: user.user.id },
            { userId: userB.user.id },
          ],
        },
      },
    });
    conversationId = conv.id;

    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      initSocketServer(server);
      server.listen(0, () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (clientSocketB && clientSocketB.connected) {
      clientSocketB.disconnect();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await cleanupTestUsers();
  });

  it('1. Rejects socket connection without token', async () => {
    await new Promise<void>((resolve) => {
      const socket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        socket.disconnect();
        resolve();
      });
    });
  });

  it('2. Authenticates and marks user online', async () => {
    await new Promise<void>((resolve) => {
      clientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: user.accessToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', async () => {
        expect(clientSocket.connected).toBe(true);

        // Verify presence in Redis
        const isOnline = await presenceService.isOnline(user.user.id);
        expect(isOnline).toBe(true);
        resolve();
      });
    });
  });

  it('3. Sends heartbeat to keep presence active', async () => {
    clientSocket.emit('presence:heartbeat');
    const isOnline = await presenceService.isOnline(user.user.id);
    expect(isOnline).toBe(true);
  });

  it('4. Broadcasts user:updated to conversation partner on profile update', async () => {
    // Connect userB socket
    await new Promise<void>((resolve) => {
      clientSocketB = Client(`http://localhost:${serverPort}`, {
        auth: { token: userB.accessToken },
        transports: ['websocket'],
      });

      clientSocketB.on('connect', () => {
        expect(clientSocketB.connected).toBe(true);
        resolve();
      });
    });

    // Listen for user:updated on clientSocketB
    const receivedPromise = new Promise<any>((resolve) => {
      clientSocketB.on('user:updated', (payload) => {
        resolve(payload);
      });
    });

    // User A updates profile
    const updateRes = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', user.authHeader)
      .send({ name: 'Updated Partner Name' });

    expect(updateRes.status).toBe(200);

    const receivedPayload = await receivedPromise;
    expect(receivedPayload.id).toBe(user.user.id);
    expect(receivedPayload.name).toBe('Updated Partner Name');
  });

  it('5. Emits message:new with identical message id as HTTP response (duplicate prevention)', async () => {
    // Listen for message:new on clientSocketB
    const receivedPromise = new Promise<any>((resolve) => {
      clientSocketB.on('message:new', (payload) => {
        resolve(payload);
      });
    });

    // User A sends message via HTTP
    const sendRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', user.authHeader)
      .send({ body: 'Hello Partner Realtime' });

    expect(sendRes.status).toBe(201);
    const createdMessage = sendRes.body.data.message;

    const socketPayload = await receivedPromise;
    expect(socketPayload.conversationId).toBe(conversationId);
    expect(socketPayload.message.id).toBe(createdMessage.id);
    expect(socketPayload.message.body).toBe('Hello Partner Realtime');
  });
});

