import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { app } from '../src/app';
import { initSocketServer } from '../src/sockets';
import { createTestUser, cleanupTestUsers } from './test.helper';
import { presenceService } from '../src/modules/presence/presence.service';

describe('Socket.io Integration Tests', () => {
  let server: http.Server;
  let serverPort: number;
  let user: any;
  let clientSocket: ClientSocket;

  beforeAll(async () => {
    await cleanupTestUsers();
    user = await createTestUser('test_ws');

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
});
