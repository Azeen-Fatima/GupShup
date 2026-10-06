import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socket.auth';
import { presenceService } from '../modules/presence/presence.service';
import { emitToConversationMembers, emitToUser } from './index';
import { logger } from '../config/logger';

export function registerSocketHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.data.user.userId;
  const userRoom = `user:${userId}`;

  // Join user's individual room
  socket.join(userRoom);
  logger.info({ userId, socketId: socket.id }, 'Socket client connected');

  // Mark online and broadcast presence
  presenceService.setOnline(userId).then(() => {
    io.emit('presence:update', { userId, isOnline: true });
  });

  // Heartbeat to keep presence active
  socket.on('presence:heartbeat', async () => {
    await presenceService.setOnline(userId);
  });

  // Typing start
  socket.on('typing:start', async (data: { conversationId?: string; recipientId?: string }) => {
    if (!data?.conversationId && !data?.recipientId) return;
    const convId = data.conversationId;
    if (convId && !convId.startsWith('new-')) {
      await presenceService.setTyping(convId, userId);
      await emitToConversationMembers(
        convId,
        'typing:update',
        { conversationId: convId, userId, isTyping: true },
        userId
      );
    }
    if (data.recipientId) {
      emitToUser(data.recipientId, 'typing:update', {
        conversationId: convId || `new-${userId}`,
        userId,
        isTyping: true,
      });
    }
  });

  // Typing stop
  socket.on('typing:stop', async (data: { conversationId?: string; recipientId?: string }) => {
    if (!data?.conversationId && !data?.recipientId) return;
    const convId = data.conversationId;
    if (convId && !convId.startsWith('new-')) {
      await presenceService.clearTyping(convId, userId);
      await emitToConversationMembers(
        convId,
        'typing:update',
        { conversationId: convId, userId, isTyping: false },
        userId
      );
    }
    if (data.recipientId) {
      emitToUser(data.recipientId, 'typing:update', {
        conversationId: convId || `new-${userId}`,
        userId,
        isTyping: false,
      });
    }
  });

  // Disconnect handler
  socket.on('disconnect', async (reason) => {
    logger.info({ userId, socketId: socket.id, reason }, 'Socket client disconnected');

    // Check if this was the last socket for this user
    try {
      const room = io.sockets.adapter.rooms.get(userRoom);
      const remainingSocketsCount = room ? room.size : 0;

      if (remainingSocketsCount === 0) {
        await presenceService.setOffline(userId);
        const lastSeen = await presenceService.getLastSeen(userId);
        io.emit('presence:update', { userId, isOnline: false, lastSeen });
      }
    } catch (err) {
      logger.error({ err, userId }, 'Error handling socket disconnect');
    }
  });
}
