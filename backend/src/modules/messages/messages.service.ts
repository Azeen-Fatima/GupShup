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
      // Check blocks
      const block = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: otherUserId },
            { blockerId: otherUserId, blockedId: userId },
          ],
        },
      });

      if (block) {
        throw new ForbiddenError('You cannot message this user', 'USER_BLOCKED');
      }

      // Check status rules
      if (conv.status === 'declined') {
        throw new ForbiddenError('This conversation was declined', 'REQUEST_DECLINED');
      }

      if (conv.status === 'pending') {
        if (conv.requesterId === userId) {
          const sentCount = await prisma.message.count({
            where: { conversationId, senderId: userId },
          });

          if (sentCount >= 1) {
            throw new ForbiddenError(
              'You can only send 1 message until your request is accepted',
              'MAX_PENDING_MESSAGES_REACHED'
            );
          }
        } else {
          // Recipient is replying: accept conversation
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'accepted' },
          });
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
