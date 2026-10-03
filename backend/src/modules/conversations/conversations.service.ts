import { prisma } from '../../db/prisma';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors';
import { presenceService } from '../presence/presence.service';
import { emitToUser } from '../../sockets';
import { CreateConversationInput } from './conversations.schemas';

export class ConversationsService {
  /**
   * Get all active conversations for a user
   */
  async getUserConversations(userId: string) {
    const members = await prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            userA: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                statusMessage: true,
              },
            },
            userB: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                statusMessage: true,
              },
            },
            requester: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
      orderBy: {
        conversation: {
          lastMessageAt: 'desc',
        },
      },
    });

    if (members.length === 0) {
      return [];
    }

    // Filter out conversations hidden by the user, unless a new message arrived after hiddenAt
    const visibleMembers = members.filter((m) => {
      if (!m.hiddenAt) return true;
      if (!m.conversation.lastMessageAt) return false;
      return m.conversation.lastMessageAt > m.hiddenAt;
    });

    const otherUserIds = Array.from(
      new Set(
        visibleMembers
          .map((m) => (m.conversation.userAId === userId ? m.conversation.userBId : m.conversation.userAId))
          .filter((id) => id !== userId)
      )
    );

    // Fetch blocks involving current user and other users
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: otherUserIds } },
          { blockerId: { in: otherUserIds }, blockedId: userId },
        ],
      },
    });

    // Fetch online statuses
    const onlineMap = await presenceService.getOnlineStatuses(otherUserIds);

    const result = await Promise.all(
      visibleMembers.map(async (m) => {
        const conv = m.conversation;
        const isSelf = conv.userAId === conv.userBId;
        const otherUser = isSelf ? conv.userA : conv.userAId === userId ? conv.userB : conv.userA;

        const isBlockedByMe = blocks.some((b) => b.blockerId === userId && b.blockedId === otherUser.id);
        const isBlockedByThem = blocks.some((b) => b.blockerId === otherUser.id && b.blockedId === userId);

        let state: 'normal' | 'pending_sent' | 'pending_received' | 'declined' | 'blocked_by_me' | 'isSelf' =
          'normal';

        if (isSelf) {
          state = 'isSelf';
        } else if (isBlockedByMe) {
          state = 'blocked_by_me';
        } else if (conv.status === 'declined') {
          state = 'declined';
        } else if (conv.status === 'pending') {
          state = conv.requesterId === userId ? 'pending_sent' : 'pending_received';
        }

        // Filter messages respecting clearedAt
        const validMessages = conv.messages.filter((msg) => {
          if (!m.clearedAt) return true;
          return msg.createdAt > m.clearedAt;
        });

        const lastMessage = validMessages.length > 0 ? validMessages[0] : null;

        // Unread count
        const unreadCutoff = m.lastReadAt || m.clearedAt || new Date(0);
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            createdAt: { gt: unreadCutoff },
          },
        });

        return {
          id: conv.id,
          status: conv.status,
          state,
          isSelf,
          isBlockedByMe,
          isBlockedByThem,
          createdAt: conv.createdAt,
          lastMessageAt: conv.lastMessageAt || conv.createdAt,
          otherUser: {
            ...otherUser,
            isOnline: isSelf ? true : !!onlineMap[otherUser.id],
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                type: lastMessage.type,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
                seenAt: lastMessage.seenAt,
                attachmentUrl: lastMessage.attachmentUrl,
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort by lastMessageAt descending
    return result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  /**
   * Get single conversation details
   */
  async getConversationById(conversationId: string, userId: string) {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      include: {
        conversation: {
          include: {
            userA: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                statusMessage: true,
                bio: true,
              },
            },
            userB: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
                statusMessage: true,
                bio: true,
              },
            },
            requester: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Conversation not found or access denied', 'CONVERSATION_NOT_FOUND');
    }

    const conv = member.conversation;
    const isSelf = conv.userAId === conv.userBId;
    const otherUser = isSelf ? conv.userA : conv.userAId === userId ? conv.userB : conv.userA;

    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUser.id },
          { blockerId: otherUser.id, blockedId: userId },
        ],
      },
    });

    const isBlockedByMe = blocks.some((b) => b.blockerId === userId && b.blockedId === otherUser.id);
    const isBlockedByThem = blocks.some((b) => b.blockerId === otherUser.id && b.blockedId === userId);

    let state: 'normal' | 'pending_sent' | 'pending_received' | 'declined' | 'blocked_by_me' | 'isSelf' =
      'normal';

    if (isSelf) {
      state = 'isSelf';
    } else if (isBlockedByMe) {
      state = 'blocked_by_me';
    } else if (conv.status === 'declined') {
      state = 'declined';
    } else if (conv.status === 'pending') {
      state = conv.requesterId === userId ? 'pending_sent' : 'pending_received';
    }

    const isOnline = isSelf ? true : await presenceService.isOnline(otherUser.id);
    const lastSeen = isSelf ? null : await presenceService.getLastSeen(otherUser.id);

    return {
      id: conv.id,
      status: conv.status,
      state,
      isSelf,
      isBlockedByMe,
      isBlockedByThem,
      requesterId: conv.requesterId,
      createdAt: conv.createdAt,
      lastMessageAt: conv.lastMessageAt,
      clearedAt: member.clearedAt,
      otherUser: {
        ...otherUser,
        isOnline,
        lastSeen,
      },
    };
  }

  /**
   * Create or fetch conversation with initial message
   */
  async createOrGetConversation(userId: string, data: CreateConversationInput) {
    const recipientId = data.recipientId;

    if (recipientId === userId) {
      // Notes to self
      let selfConv = await prisma.conversation.findFirst({
        where: { userAId: userId, userBId: userId },
      });

      if (!selfConv) {
        selfConv = await prisma.conversation.create({
          data: {
            userAId: userId,
            userBId: userId,
            requesterId: userId,
            status: 'accepted',
          },
        });
        await prisma.conversationMember.create({
          data: { conversationId: selfConv.id, userId },
        });
      }

      return this.sendInitialMessage(selfConv.id, userId, data);
    }

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!recipient) {
      throw new NotFoundError('Recipient user not found', 'USER_NOT_FOUND');
    }

    // Check if blocked in either direction
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: recipientId },
          { blockerId: recipientId, blockedId: userId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenError('You cannot message this user', 'USER_BLOCKED');
    }

    const [userAId, userBId] = userId < recipientId ? [userId, recipientId] : [recipientId, userId];

    let conv = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: { members: true },
    });

    if (conv) {
      if (conv.status === 'declined') {
        if (conv.requesterId === userId) {
          throw new ForbiddenError(
            'Your previous message request was declined by this user',
            'REQUEST_DECLINED'
          );
        } else {
          // Current user was the recipient who previously declined, but is now starting a conversation
          conv = await prisma.conversation.update({
            where: { id: conv.id },
            data: { status: 'accepted' },
            include: { members: true },
          });
        }
      } else if (conv.status === 'pending') {
        if (conv.requesterId === userId) {
          const sentCount = await prisma.message.count({
            where: { conversationId: conv.id, senderId: userId },
          });
          if (sentCount >= 1) {
            throw new ForbiddenError(
              'You can only send 1 message until your request is accepted',
              'MAX_PENDING_MESSAGES_REACHED'
            );
          }
        } else {
          // Requester was the other user, current user is replying: automatically accept!
          conv = await prisma.conversation.update({
            where: { id: conv.id },
            data: { status: 'accepted' },
            include: { members: true },
          });
        }
      }
    } else {
      // Create new conversation and members
      conv = await prisma.conversation.create({
        data: {
          userAId,
          userBId,
          requesterId: userId,
          status: 'pending',
          members: {
            create: [{ userId }, { userId: recipientId }],
          },
        },
        include: { members: true },
      });
    }

    return this.sendInitialMessage(conv.id, userId, data, recipientId);
  }

  /**
   * Helper to send initial message and notify recipient
   */
  private async sendInitialMessage(
    conversationId: string,
    senderId: string,
    data: CreateConversationInput,
    recipientId?: string
  ) {
    let msgType = 'text';
    let body: string | null = null;
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentSize: string | null = null;
    let attachmentMime: string | null = null;

    if (typeof data.initialMessage === 'object') {
      msgType = data.initialMessage.type || 'text';
      body = data.initialMessage.body || null;
      attachmentUrl = data.initialMessage.attachmentUrl || null;
      attachmentName = data.initialMessage.attachmentName || null;
      attachmentSize = data.initialMessage.attachmentSize || null;
      attachmentMime = data.initialMessage.attachmentMime || null;
    } else if (typeof data.initialMessage === 'string') {
      body = data.initialMessage;
    } else if (data.message) {
      body = data.message;
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: msgType,
        body,
        attachmentUrl,
        attachmentName,
        attachmentSize,
        attachmentMime,
      },
    });

    // Update conversation lastMessageAt and unhide for members
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

    // Emit socket event if recipient exists
    if (recipientId && recipientId !== senderId) {
      emitToUser(recipientId, 'message:new', {
        conversationId,
        message,
      });
      emitToUser(recipientId, 'conversation:updated', {
        conversationId,
      });
    }

    return {
      conversationId,
      message,
    };
  }

  /**
   * Accept pending conversation request
   */
  async acceptConversation(conversationId: string, userId: string) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });

    if (!conv) {
      throw new NotFoundError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    const isMember = conv.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this conversation', 'NOT_A_MEMBER');
    }

    if (conv.requesterId === userId && conv.userAId !== conv.userBId) {
      throw new BadRequestError('You cannot accept your own request', 'CANNOT_ACCEPT_OWN_REQUEST');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'accepted' },
    });

    // Notify other member
    const otherMember = conv.members.find((m) => m.userId !== userId);
    if (otherMember) {
      emitToUser(otherMember.userId, 'conversation:updated', {
        conversationId,
        status: 'accepted',
      });
    }

    return updated;
  }

  /**
   * Decline pending conversation request
   */
  async declineConversation(conversationId: string, userId: string) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });

    if (!conv) {
      throw new NotFoundError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    const isMember = conv.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenError('You are not a member of this conversation', 'NOT_A_MEMBER');
    }

    if (conv.requesterId === userId) {
      throw new BadRequestError('You cannot decline your own request', 'CANNOT_DECLINE_OWN_REQUEST');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'declined' },
    });

    // Notify other member
    const otherMember = conv.members.find((m) => m.userId !== userId);
    if (otherMember) {
      emitToUser(otherMember.userId, 'conversation:updated', {
        conversationId,
        status: 'declined',
      });
    }

    return updated;
  }

  /**
   * Block other user in a conversation
   */
  async blockConversationUser(conversationId: string, userId: string) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      throw new NotFoundError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    if (conv.userAId === conv.userBId) {
      throw new BadRequestError('You cannot block yourself', 'CANNOT_BLOCK_SELF');
    }

    const targetUserId = conv.userAId === userId ? conv.userBId : conv.userAId;

    await prisma.block.upsert({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: targetUserId },
      },
      update: {},
      create: {
        blockerId: userId,
        blockedId: targetUserId,
      },
    });

    emitToUser(userId, 'conversation:updated', { conversationId, blocked: true });
    emitToUser(targetUserId, 'conversation:updated', { conversationId, blockedByOther: true });

    return { success: true };
  }

  /**
   * Unblock other user in a conversation
   */
  async unblockConversationUser(conversationId: string, userId: string) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      throw new NotFoundError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    const targetUserId = conv.userAId === userId ? conv.userBId : conv.userAId;

    await prisma.block.deleteMany({
      where: {
        blockerId: userId,
        blockedId: targetUserId,
      },
    });

    emitToUser(userId, 'conversation:updated', { conversationId, blocked: false });
    emitToUser(targetUserId, 'conversation:updated', { conversationId, blockedByOther: false });

    return { success: true };
  }

  /**
   * Clear chat history for user
   */
  async clearHistory(conversationId: string, userId: string) {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!member) {
      throw new NotFoundError('Conversation member record not found', 'NOT_A_MEMBER');
    }

    await prisma.conversationMember.update({
      where: { id: member.id },
      data: { clearedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Hide / delete conversation from chat list
   */
  async hideConversation(conversationId: string, userId: string) {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!member) {
      throw new NotFoundError('Conversation member record not found', 'NOT_A_MEMBER');
    }

    await prisma.conversationMember.update({
      where: { id: member.id },
      data: { hiddenAt: new Date() },
    });

    return { success: true };
  }
}

export const conversationsService = new ConversationsService();
