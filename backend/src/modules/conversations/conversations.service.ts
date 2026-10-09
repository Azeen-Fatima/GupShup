import { prisma } from '../../db/prisma';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors';
import { presenceService } from '../presence/presence.service';
import { emitToUser } from '../../sockets';
import { CreateConversationInput } from './conversations.schemas';
import { chatLockService } from '../chatLock/chatLock.service';

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
                avatarUrl: true,
              },
            },
            messages: {
              where: {
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
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

    // Fetch chat locks for current user
    const userLocks = await prisma.chatLock.findMany({
      where: { userId },
      select: { peerUserId: true },
    });
    const lockedPeerSet = new Set(userLocks.map((l) => l.peerUserId));

    const result = await Promise.all(
      visibleMembers.map(async (m) => {
        const conv = m.conversation;
        const isSelf = conv.userAId === conv.userBId;
        const otherUser = isSelf ? conv.userA : conv.userAId === userId ? conv.userB : conv.userA;
        const isLocked = !isSelf && lockedPeerSet.has(otherUser.id);

        const isBlockedByMe =
          blocks.some((b) => b.blockerId === userId && b.blockedId === otherUser.id) ||
          (conv.status === 'blocked' && conv.blockedById === userId);
        const isBlockedByThem =
          blocks.some((b) => b.blockerId === otherUser.id && b.blockedId === userId) ||
          (conv.status === 'blocked' && conv.blockedById === otherUser.id);

        // Blocker view: blocked chats move to Settings > Blocked
        if (isBlockedByMe) {
          return null;
        }

        // Recipient view of declined: declined chats move to Settings > Declined
        if (conv.status === 'declined' && conv.requesterId !== userId) {
          return null;
        }

        let state:
          | 'normal'
          | 'pending_sent'
          | 'pending_received'
          | 'declined'
          | 'blocked_by_them'
          | 'isSelf' = 'normal';
        let effectiveBlockedByThem = false;

        if (isSelf) {
          state = 'isSelf';
        } else if (isBlockedByThem) {
          if (!conv.wasAccepted) {
            // Silent block: Sender sees normal pending_sent state
            state = 'pending_sent';
            effectiveBlockedByThem = false;
          } else {
            state = 'blocked_by_them';
            effectiveBlockedByThem = true;
          }
        } else if (conv.status === 'declined') {
          state = 'declined';
        } else if (conv.status === 'pending') {
          state = conv.requesterId === userId ? 'pending_sent' : 'pending_received';
        }

        let canSendExtraMessage = false;
        if (conv.status === 'declined' && conv.requesterId === userId && conv.declineCount === 1) {
          const sentAfterDecline = conv.messages.filter(
            (msg) => conv.declinedAt && msg.createdAt > conv.declinedAt && msg.senderId === userId
          ).length;
          canSendExtraMessage = sentAfterDecline === 0;
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

          const showPresence = isSelf || conv.status === 'accepted';
          const isOnline = showPresence ? (isSelf ? true : !!onlineMap[otherUser.id]) : false;
          const lastSeen = showPresence && !isSelf ? await presenceService.getLastSeen(otherUser.id) : null;

          return {
            id: conv.id,
            status:
              conv.status === 'blocked' && !conv.wasAccepted && isBlockedByThem ? 'pending' : conv.status,
            state,
            isSelf,
            isBlockedByMe: false,
            isBlockedByThem: effectiveBlockedByThem,
            isLocked,
            disappearingMode: conv.disappearingMode || 'off',
            declineCount: conv.declineCount,
            declinedAt: conv.declinedAt,
            canSendExtraMessage,
            createdAt: conv.createdAt,
            lastMessageAt: conv.lastMessageAt || conv.createdAt,
            otherUser: {
              ...otherUser,
              isOnline,
              lastSeen,
            },
            lastMessage: lastMessage
              ? isLocked
                ? {
                    id: lastMessage.id,
                    body: 'Locked chat',
                    type: 'text',
                    senderId: lastMessage.senderId,
                    createdAt: lastMessage.createdAt,
                    deliveredAt: lastMessage.deliveredAt,
                    seenAt: lastMessage.seenAt,
                    attachmentUrl: null,
                    clientId: null,
                    isMasked: true,
                  }
                : {
                    id: lastMessage.id,
                    body: lastMessage.body,
                    type: lastMessage.type,
                    senderId: lastMessage.senderId,
                    createdAt: lastMessage.createdAt,
                    deliveredAt: lastMessage.deliveredAt,
                    seenAt: lastMessage.seenAt,
                    attachmentUrl: lastMessage.attachmentUrl,
                    clientId: lastMessage.clientId,
                  }
              : null,
            unreadCount,
          };
      })
    );

    const filteredResult = result.filter(Boolean) as any[];
    return filteredResult.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
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
                avatarUrl: true,
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

    const isBlockedByMe =
      blocks.some((b) => b.blockerId === userId && b.blockedId === otherUser.id) ||
      (conv.status === 'blocked' && conv.blockedById === userId);
    const isBlockedByThem =
      blocks.some((b) => b.blockerId === otherUser.id && b.blockedId === userId) ||
      (conv.status === 'blocked' && conv.blockedById === otherUser.id);

    let state:
      | 'normal'
      | 'pending_sent'
      | 'pending_received'
      | 'declined'
      | 'blocked_by_me'
      | 'blocked_by_them'
      | 'isSelf' = 'normal';
    let effectiveBlockedByThem = false;

    if (isSelf) {
      state = 'isSelf';
    } else if (isBlockedByMe) {
      state = 'blocked_by_me';
    } else if (isBlockedByThem) {
      if (!conv.wasAccepted) {
        // Silent block while pending
        state = 'pending_sent';
        effectiveBlockedByThem = false;
      } else {
        state = 'blocked_by_them';
        effectiveBlockedByThem = true;
      }
    } else if (conv.status === 'declined') {
      state = 'declined';
    } else if (conv.status === 'pending') {
      state = conv.requesterId === userId ? 'pending_sent' : 'pending_received';
    }

    let canSendExtraMessage = false;
    if (conv.status === 'declined' && conv.requesterId === userId && conv.declineCount === 1) {
      const extraSent = await prisma.message.count({
        where: {
          conversationId,
          senderId: userId,
          ...(conv.declinedAt ? { createdAt: { gt: conv.declinedAt } } : {}),
        },
      });
      canSendExtraMessage = extraSent === 0;
    }

    const showPresence = isSelf || conv.status === 'accepted';
    const isOnline = showPresence ? (isSelf ? true : await presenceService.isOnline(otherUser.id)) : false;
    const lastSeen = showPresence && !isSelf ? await presenceService.getLastSeen(otherUser.id) : null;
    const isLocked = !isSelf && (await chatLockService.isPeerLocked(userId, otherUser.id));

    return {
      id: conv.id,
      status:
        conv.status === 'blocked' && !conv.wasAccepted && isBlockedByThem ? 'pending' : conv.status,
      state,
      isSelf,
      isBlockedByMe,
      isBlockedByThem: effectiveBlockedByThem,
      isLocked,
      disappearingMode: conv.disappearingMode || 'off',
      declineCount: conv.declineCount,
      declinedAt: conv.declinedAt,
      canSendExtraMessage,
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
            wasAccepted: true,
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

    // Check if current user blocked the recipient
    const iBlockedRecipient = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: recipientId },
      },
    });
    if (iBlockedRecipient) {
      throw new ForbiddenError('You blocked this user. Unblock to message them.', 'USER_BLOCKED');
    }

    const [userAId, userBId] = userId < recipientId ? [userId, recipientId] : [recipientId, userId];

    let conv = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: { members: true },
    });

    // Check if recipient blocked the current user
    const recipientBlockedMe = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: recipientId, blockedId: userId },
      },
    });

    let isSilentBlock = false;
    if (recipientBlockedMe) {
      if (conv && !conv.wasAccepted) {
        isSilentBlock = true;
      } else {
        throw new ForbiddenError("You can't message this person right now.", 'USER_BLOCKED');
      }
    }

    // Check attachments for request messages
    const hasAttachment =
      data.initialMessage &&
      typeof data.initialMessage === 'object' &&
      (data.initialMessage.type !== 'text' || !!data.initialMessage.attachmentUrl);

    if (conv) {
      if (conv.status === 'declined') {
        if (conv.requesterId === userId) {
          if (conv.declineCount >= 2) {
            throw new ForbiddenError(
              'Request declined. You can message again if they accept.',
              'REQUEST_DECLINED'
            );
          }

          // Check if sender already used their 1 extra message
          const extraSent = await prisma.message.count({
            where: {
              conversationId: conv.id,
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

          if (hasAttachment) {
            throw new ForbiddenError(
              'Attachments are not allowed for message requests',
              'ATTACHMENTS_NOT_ALLOWED'
            );
          }

          // Move back to pending for recipient
          conv = await prisma.conversation.update({
            where: { id: conv.id },
            data: { status: 'pending' },
            include: { members: true },
          });
        } else {
          // Recipient is replying: accept conversation
          conv = await prisma.conversation.update({
            where: { id: conv.id },
            data: { status: 'accepted', wasAccepted: true },
            include: { members: true },
          });
          emitToUser(conv.requesterId, 'request:accepted', { conversationId: conv.id });
        }
      } else if (conv.status === 'pending' || (conv.status === 'blocked' && isSilentBlock)) {
        if (conv.requesterId === userId) {
          if (hasAttachment) {
            throw new ForbiddenError(
              'Attachments are not allowed for message requests',
              'ATTACHMENTS_NOT_ALLOWED'
            );
          }

          const sentCount = await prisma.message.count({
            where: { conversationId: conv.id, senderId: userId },
          });
          if (sentCount >= 1) {
            throw new ForbiddenError(
              'You can only send 1 message until your request is accepted',
              'REQUEST_PENDING_LIMIT'
            );
          }
        } else {
          // Recipient replying: accept conversation
          conv = await prisma.conversation.update({
            where: { id: conv.id },
            data: { status: 'accepted', wasAccepted: true },
            include: { members: true },
          });
          emitToUser(conv.requesterId, 'request:accepted', { conversationId: conv.id });
        }
      }
    } else {
      // New conversation
      if (hasAttachment) {
        throw new ForbiddenError(
          'Attachments are not allowed for message requests',
          'ATTACHMENTS_NOT_ALLOWED'
        );
      }

      conv = await prisma.conversation.create({
        data: {
          userAId,
          userBId,
          requesterId: userId,
          status: 'pending',
          declineCount: 0,
          wasAccepted: false,
          members: {
            create: [{ userId }, { userId: recipientId }],
          },
        },
        include: { members: true },
      });
    }

    return this.sendInitialMessage(conv.id, userId, data, recipientId, isSilentBlock);
  }

  /**
   * Helper to send initial message and notify recipient
   */
  private async sendInitialMessage(
    conversationId: string,
    senderId: string,
    data: CreateConversationInput,
    recipientId?: string,
    isSilent = false
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

    let clientId: string | null = null;
    if (typeof data.initialMessage === 'object' && (data.initialMessage as any).clientId) {
      clientId = (data.initialMessage as any).clientId;
    } else if ((data as any).clientId) {
      clientId = (data as any).clientId;
    }

    if (clientId) {
      const existing = await prisma.message.findFirst({
        where: {
          conversationId,
          senderId,
          clientId,
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
      if (existing) {
        return { conversationId, message: existing };
      }
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { disappearingMode: true, status: true },
    });

    let expiresAt: Date | null = null;
    if (conv?.disappearingMode === '24h') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (conv?.disappearingMode === '7d') {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
        clientId,
        expiresAt,
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

    // Emit socket event if recipient exists and not silent
    if (recipientId && recipientId !== senderId && !isSilent) {
      const recipientLockedSender = await chatLockService.isPeerLocked(recipientId, senderId);
      if (recipientLockedSender) {
        emitToUser(recipientId, 'message:new', {
          conversationId,
          isLocked: true,
          message: {
            id: message.id,
            conversationId,
            senderId,
            type: 'text',
            body: 'Locked chat',
            createdAt: message.createdAt,
            sender: message.sender,
            isMasked: true,
          },
        });
      } else {
        emitToUser(recipientId, 'message:new', {
          conversationId,
          message,
        });
      }

      if (conv?.status !== 'accepted') {
        emitToUser(recipientId, 'request:new', {
          conversationId,
          message,
        });
      }

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
   * Accept pending conversation request (Works from Requests, Declined, and after Unblock)
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

    const targetUserId = conv.userAId === userId ? conv.userBId : conv.userAId;

    // Clear any active blocks between them when accepted
    await prisma.block.deleteMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: userId },
        ],
      },
    });

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'accepted',
        wasAccepted: true,
        blockedAt: null,
        blockedById: null,
      },
    });

    // Notify other member and current user
    const otherMember = conv.members.find((m) => m.userId !== userId);
    if (otherMember) {
      emitToUser(otherMember.userId, 'request:accepted', {
        conversationId,
      });
      emitToUser(otherMember.userId, 'conversation:updated', {
        conversationId,
        status: 'accepted',
      });

      // Presence unhides live
      Promise.all([
        presenceService.isOnline(userId),
        presenceService.getLastSeen(userId),
        presenceService.isOnline(otherMember.userId),
        presenceService.getLastSeen(otherMember.userId),
      ]).then(([userOnline, userLastSeen, otherOnline, otherLastSeen]) => {
        emitToUser(otherMember.userId, 'presence:update', {
          userId,
          isOnline: userOnline,
          lastSeen: userLastSeen,
        });
        emitToUser(userId, 'presence:update', {
          userId: otherMember.userId,
          isOnline: otherOnline,
          lastSeen: otherLastSeen,
        });
      });
    }

    emitToUser(userId, 'request:accepted', {
      conversationId,
    });
    emitToUser(userId, 'conversation:updated', {
      conversationId,
      status: 'accepted',
    });

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

    const nextDeclineCount = conv.declineCount + 1;

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'declined',
        declineCount: nextDeclineCount,
        declinedAt: new Date(),
      },
    });

    // Notify requester and recipient
    const otherMember = conv.members.find((m) => m.userId !== userId);
    if (otherMember) {
      emitToUser(otherMember.userId, 'request:declined', {
        conversationId,
        declineCount: nextDeclineCount,
      });
      emitToUser(otherMember.userId, 'conversation:updated', {
        conversationId,
        status: 'declined',
        declineCount: nextDeclineCount,
      });

      // Presence hides live
      emitToUser(otherMember.userId, 'presence:update', {
        userId,
        isOnline: false,
        lastSeen: null,
      });
      emitToUser(userId, 'presence:update', {
        userId: otherMember.userId,
        isOnline: false,
        lastSeen: null,
      });
    }

    emitToUser(userId, 'request:declined', {
      conversationId,
      declineCount: nextDeclineCount,
    });
    emitToUser(userId, 'conversation:updated', {
      conversationId,
      status: 'declined',
      declineCount: nextDeclineCount,
    });

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
    const isSilentBlock = conv.status === 'pending' || conv.status === 'declined' || !conv.wasAccepted;

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

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'blocked',
        blockedAt: new Date(),
        blockedById: userId,
      },
    });

    // Blocker gets updated list and partner is hidden
    emitToUser(userId, 'conversation:updated', { conversationId });
    emitToUser(userId, 'presence:update', {
      userId: targetUserId,
      isOnline: false,
      lastSeen: null,
    });

    // Target user:
    // If blocked while pending: SILENT (must NOT learn about the block)
    // If blocked after accepted: NEUTRAL conversation:updated event and presence hide
    if (!isSilentBlock) {
      emitToUser(targetUserId, 'conversation:updated', { conversationId });
      emitToUser(targetUserId, 'presence:update', {
        userId,
        isOnline: false,
        lastSeen: null,
      });
    }

    return { success: true };
  }

  /**
   * Unblock other user in a conversation or by block/user ID
   */
  async unblockConversationUser(conversationId: string, userId: string) {
    let conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    let targetUserId: string;

    if (conv) {
      targetUserId = conv.userAId === userId ? conv.userBId : conv.userAId;
    } else {
      const block = await prisma.block.findFirst({
        where: {
          OR: [
            { id: conversationId, blockerId: userId },
            { blockerId: userId, blockedId: conversationId },
          ],
        },
      });

      if (!block) {
        throw new NotFoundError('Conversation or block record not found', 'CONVERSATION_NOT_FOUND');
      }

      targetUserId = block.blockedId;
      conv = await prisma.conversation.findFirst({
        where: {
          OR: [
            { userAId: userId, userBId: targetUserId },
            { userAId: targetUserId, userBId: userId },
          ],
        },
      });
    }

    await prisma.block.deleteMany({
      where: {
        blockerId: userId,
        blockedId: targetUserId,
      },
    });

    if (conv) {
      // Unblock returns the chat to PENDING (Accept / Decline again)
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          status: 'pending',
          blockedAt: null,
          blockedById: null,
          wasAccepted: false,
        },
      });

      emitToUser(userId, 'conversation:updated', { conversationId: conv.id });
      emitToUser(userId, 'request:new', { conversationId: conv.id });
      emitToUser(targetUserId, 'conversation:updated', { conversationId: conv.id });
    }

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
   * Hide / delete conversation from chat list (soft delete: clears messages and hides chat for current user)
   */
  async hideConversation(conversationId: string, userId: string) {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!member) {
      throw new NotFoundError('Conversation member record not found', 'NOT_A_MEMBER');
    }

    const now = new Date();
    await prisma.conversationMember.update({
      where: { id: member.id },
      data: { hiddenAt: now, clearedAt: now },
    });

    emitToUser(userId, 'conversation:updated', { conversationId });

    return { success: true };
  }

  /**
   * Set disappearing message mode ('off', '24h', '7d')
   */
  async setDisappearingMode(conversationId: string, userId: string, mode: 'off' | '24h' | '7d') {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: {
        conversation: {
          include: { members: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!member) {
      throw new ForbiddenError('You are not a member of this conversation', 'NOT_A_MEMBER');
    }

    const conv = member.conversation;
    if (conv.status !== 'accepted' && conv.userAId !== conv.userBId) {
      throw new BadRequestError('Disappearing messages can only be configured for accepted chats', 'NOT_ACCEPTED');
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { disappearingMode: mode },
    });

    const modeText =
      mode === 'off'
        ? 'turned off disappearing messages'
        : `turned on disappearing messages: ${mode === '24h' ? '24 hours' : '7 days'}`;
    const systemText = `${member.user.name} ${modeText}`;

    const systemMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: 'system',
        body: systemText,
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: systemMessage.createdAt },
    });

    for (const m of conv.members) {
      emitToUser(m.userId, 'message:new', {
        conversationId,
        message: systemMessage,
      });
      emitToUser(m.userId, 'conversation:updated', {
        conversationId,
        disappearingMode: mode,
      });
    }

    return { success: true, disappearingMode: mode, message: systemMessage };
  }
}

export const conversationsService = new ConversationsService();
