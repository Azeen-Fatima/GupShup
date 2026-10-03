import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socket.auth';
import { presenceService } from '../modules/presence/presence.service';
import { emitToConversationMembers } from './index';
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
  socket.on('typing:start', async (data: { conversationId: string }) => {
    if (!data?.conversationId) return;
    await presenceService.setTyping(data.conversationId, userId);
    await emitToConversationMembers(
      data.conversationId,
      'typing:update',
      { conversationId: data.conversationId, userId, isTyping: true },
      userId
    );
  });

  // Typing stop
  socket.on('typing:stop', async (data: { conversationId: string }) => {
    if (!data?.conversationId) return;
    await presenceService.clearTyping(data.conversationId, userId);
    await emitToConversationMembers(
      data.conversationId,
      'typing:update',
      { conversationId: data.conversationId, userId, isTyping: false },
      userId
    );
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
