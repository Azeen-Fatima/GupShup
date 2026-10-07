import { Server } from 'socket.io';
import { AuthenticatedSocket } from './socket.auth';
import { presenceService } from '../modules/presence/presence.service';
import { messagesService } from '../modules/messages/messages.service';
import { emitToConversationMembers, emitToUser } from './index';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';

/**
 * Broadcast presence update strictly to conversation partners where status is 'accepted'
 */
async function broadcastPresenceToAcceptedPartners(
  userId: string,
  isOnline: boolean,
  lastSeen?: string | null
) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        status: 'accepted',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    });

    const partnerIds = new Set<string>();
    for (const c of conversations) {
      const partnerId = c.userAId === userId ? c.userBId : c.userAId;
      if (partnerId !== userId) {
        partnerIds.add(partnerId);
      }
    }

    const payload = { userId, isOnline, lastSeen: lastSeen ?? null };
    for (const pid of partnerIds) {
      emitToUser(pid, 'presence:update', payload);
    }
  } catch (err) {
    logger.error({ err, userId }, 'Failed to broadcast presence to accepted partners');
  }
}

export function registerSocketHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.data.user.userId;
  const userRoom = `user:${userId}`;

  // Join user's individual room
  socket.join(userRoom);
  logger.info({ userId, socketId: socket.id }, 'Socket client connected');

  // Mark online and broadcast presence only to accepted partners
  presenceService.setOnline(userId).then(async () => {
    await broadcastPresenceToAcceptedPartners(userId, true);
  });

  // Mark pending undelivered messages as delivered when recipient connects
  prisma.message
    .findMany({
      where: {
        deliveredAt: null,
        senderId: { not: userId },
        conversation: {
          members: {
            some: { userId },
          },
        },
      },
      select: { id: true, conversationId: true, senderId: true, clientId: true },
    })
    .then(async (undelivered) => {
      if (undelivered.length > 0) {
        const now = new Date();
        const ids = undelivered.map((m) => m.id);
        await prisma.message.updateMany({
          where: { id: { in: ids } },
          data: { deliveredAt: now },
        });

        for (const msg of undelivered) {
          emitToUser(msg.senderId, 'message:delivered', {
            messageId: msg.id,
            clientId: msg.clientId,
            conversationId: msg.conversationId,
            deliveredAt: now.toISOString(),
          });
        }
      }
    })
    .catch((err) => {
      logger.error({ err, userId }, 'Failed to mark messages delivered on connect');
    });

  // Heartbeat to keep presence active
  socket.on('presence:heartbeat', async () => {
    await presenceService.setOnline(userId);
  });

  // Message delivered acknowledgement from client
  socket.on(
    'message:delivered',
    async (data: { messageId?: string; conversationId?: string; clientId?: string }) => {
      if (!data?.messageId && !data?.conversationId && !data?.clientId) return;
      try {
        const now = new Date();
        let targetMessage: {
          id: string;
          conversationId: string;
          senderId: string;
          clientId: string | null;
        } | null = null;

        if (data.messageId) {
          targetMessage = await prisma.message.findUnique({
            where: { id: data.messageId },
            select: { id: true, conversationId: true, senderId: true, clientId: true },
          });
        } else if (data.clientId && data.conversationId) {
          targetMessage = await prisma.message.findFirst({
            where: { conversationId: data.conversationId, clientId: data.clientId },
            select: { id: true, conversationId: true, senderId: true, clientId: true },
          });
        }

        if (targetMessage && targetMessage.senderId !== userId) {
          await prisma.message.update({
            where: { id: targetMessage.id },
            data: { deliveredAt: now },
          });

          emitToUser(targetMessage.senderId, 'message:delivered', {
            messageId: targetMessage.id,
            clientId: targetMessage.clientId,
            conversationId: targetMessage.conversationId,
            deliveredAt: now.toISOString(),
          });
        }
      } catch (err) {
        logger.error({ err, data }, 'Failed to handle message:delivered event');
      }
    }
  );

  // Message read acknowledgement from client
  socket.on('message:read', async (data: { conversationId: string }) => {
    if (!data?.conversationId) return;
    try {
      await messagesService.markSeen(data.conversationId, userId);
    } catch (err) {
      logger.error({ err, data }, 'Failed to handle message:read event');
    }
  });

  // Typing start (only broadcast if conversation is accepted or self)
  socket.on('typing:start', async (data: { conversationId?: string; recipientId?: string }) => {
    if (!data?.conversationId && !data?.recipientId) return;
    const convId = data.conversationId;
    if (convId && !convId.startsWith('new-')) {
      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
        select: { status: true, userAId: true, userBId: true },
      });
      if (conv && (conv.status === 'accepted' || conv.userAId === conv.userBId)) {
        await presenceService.setTyping(convId, userId);
        await emitToConversationMembers(
          convId,
          'typing:update',
          { conversationId: convId, userId, isTyping: true },
          userId
        );
      }
    }
  });

  // Typing stop (only broadcast if conversation is accepted or self)
  socket.on('typing:stop', async (data: { conversationId?: string; recipientId?: string }) => {
    if (!data?.conversationId && !data?.recipientId) return;
    const convId = data.conversationId;
    if (convId && !convId.startsWith('new-')) {
      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
        select: { status: true, userAId: true, userBId: true },
      });
      if (conv && (conv.status === 'accepted' || conv.userAId === conv.userBId)) {
        await presenceService.clearTyping(convId, userId);
        await emitToConversationMembers(
          convId,
          'typing:update',
          { conversationId: convId, userId, isTyping: false },
          userId
        );
      }
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
        await broadcastPresenceToAcceptedPartners(userId, false, lastSeen);
      }
    } catch (err) {
      logger.error({ err, userId }, 'Error handling socket disconnect');
    }
  });
}
