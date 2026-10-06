import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { emitToUser } from '../../sockets';
import { SendMessageInput, GetMessagesQueryInput } from './messages.schemas';

export class MessagesService {
  /**
   * Get paginated messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    query: GetMessagesQueryInput
  ) {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!member) {
      throw new ForbiddenError('You are not a member of this conversation', 'NOT_A_MEMBER');
    }

    const limit = Math.min(query.limit || 30, 50);
    const whereClause: any = {
      conversationId,
    };

    if (member.clearedAt) {
      whereClause.createdAt = { gt: member.clearedAt };
    }

    if (query.cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: query.cursor },
      });

      if (cursorMessage) {
        whereClause.createdAt = {
          ...(whereClause.createdAt || {}),
          lt: cursorMessage.createdAt,
        };
      }
    }

    const items = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const messages = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : null;

    return {
      messages: messages.reverse(),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId: string, userId: string, input: SendMessageInput) {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      include: {
        conversation: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You are not a member of this conversation', 'NOT_A_MEMBER');
    }

    const conv = member.conversation;
    const otherUserId = conv.userAId === userId ? conv.userBId : conv.userAId;

    if (conv.userAId !== conv.userBId) {
      // Check if current user blocked the other user
      const iBlockedOther = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: userId, blockedId: otherUserId },
        },
      });
      if (iBlockedOther) {
        throw new ForbiddenError('You blocked this user. Unblock to message them.', 'USER_BLOCKED');
      }

      // Check if other user blocked current user
      const otherBlockedMe = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: otherUserId, blockedId: userId },
        },
      });

      if (otherBlockedMe) {
        if (conv.status === 'blocked' && !conv.wasAccepted) {
          // Silent block while pending
          const sentCount = await prisma.message.count({
            where: { conversationId, senderId: userId },
          });
          if (sentCount >= 1) {
            throw new ForbiddenError(
              'You can only send 1 message until your request is accepted',
              'REQUEST_PENDING_LIMIT'
            );
          }

          if (input.type !== 'text' || input.attachmentUrl) {
            throw new ForbiddenError(
              'Attachments are not allowed for message requests',
              'ATTACHMENTS_NOT_ALLOWED'
            );
          }

          // Create message silently without notifying the blocker
          const silentMessage = await prisma.message.create({
            data: {
              conversationId,
              senderId: userId,
              type: 'text',
              body: input.body || null,
            },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          });

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: silentMessage.createdAt },
          });

          emitToUser(userId, 'message:new', {
            conversationId,
            message: silentMessage,
          });

          return silentMessage;
        }

        throw new ForbiddenError("You can't message this person right now.", 'USER_BLOCKED');
      }

      // Check attachment restrictions for message requests
      if (conv.status === 'pending' || conv.status === 'declined') {
        if (input.type !== 'text' || input.attachmentUrl) {
          throw new ForbiddenError(
            'Attachments are not allowed for message requests',
            'ATTACHMENTS_NOT_ALLOWED'
          );
        }
      }

      // Check status rules
      if (conv.status === 'declined') {
        if (conv.requesterId === userId) {
          if (conv.declineCount >= 2) {
            throw new ForbiddenError(
              'Request declined. You can message again if they accept.',
              'REQUEST_DECLINED'
            );
          }

          // 1st decline: sender gets 1 more message
          const extraSent = await prisma.message.count({
            where: {
              conversationId,
              senderId: userId,
              ...(conv.declinedAt ? { createdAt: { gt: conv.declinedAt } } : {}),
            },
          });
          if (extraSent >= 1) {
            throw new ForbiddenError(
              'Request declined. You can message again if they accept.',
              'REQUEST_DECLINED'
            );
          }

          // Move back to pending for recipient
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'pending' },
          });
        } else {
          // Recipient is replying: accept conversation
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'accepted', wasAccepted: true },
          });
          emitToUser(conv.requesterId, 'request:accepted', { conversationId });
        }
      } else if (conv.status === 'pending') {
        if (conv.requesterId === userId) {
          const sentCount = await prisma.message.count({
            where: { conversationId, senderId: userId },
          });

          if (sentCount >= 1) {
            throw new ForbiddenError(
              'You can only send 1 message until your request is accepted',
              'REQUEST_PENDING_LIMIT'
            );
          }
        } else {
          // Recipient is replying: accept conversation
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'accepted', wasAccepted: true },
          });
          emitToUser(conv.requesterId, 'request:accepted', { conversationId });
        }
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: input.type || 'text',
        body: input.body || null,
        attachmentUrl: input.attachmentUrl || null,
        attachmentName: input.attachmentName || null,
        attachmentSize: input.attachmentSize || null,
        attachmentMime: input.attachmentMime || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update lastMessageAt and unhide conversation for members
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      }),
      prisma.conversationMember.updateMany({
        where: { conversationId },
        data: { hiddenAt: null },
      }),
    ]);

    // Emit socket event to recipient and sender
    emitToUser(otherUserId, 'message:new', {
      conversationId,
      message,
    });

    if (otherUserId !== userId) {
      emitToUser(userId, 'message:new', {
        conversationId,
        message,
      });
    }

    return message;
  }

  /**
   * Mark messages as seen in conversation
   */
  async markSeen(conversationId: string, userId: string) {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      include: {
        conversation: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You are not a member of this conversation', 'NOT_A_MEMBER');
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.conversationMember.update({
        where: { id: member.id },
        data: { lastReadAt: now },
      }),
      prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          seenAt: null,
        },
        data: { seenAt: now },
      }),
    ]);

    const otherUserId =
      member.conversation.userAId === userId
        ? member.conversation.userBId
        : member.conversation.userAId;

    if (otherUserId !== userId) {
      emitToUser(otherUserId, 'message:seen', {
        conversationId,
        seenBy: userId,
        seenAt: now,
      });
    }

    return { success: true };
  }
}

export const messagesService = new MessagesService();
