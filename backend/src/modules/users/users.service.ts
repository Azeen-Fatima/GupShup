import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import { UpdateProfileInput } from './users.schemas';
import { emitToUser } from '../../sockets';

export type RelationshipStatus =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted'
  | 'declined'
  | 'blocked_by_me'
  | 'blocked_by_them';

export class UsersService {
  /**
   * Helper to broadcast user:updated to all conversation partners
   */
  private async notifyUserUpdated(user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio?: string | null;
    statusMessage?: string | null;
  }) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [{ userAId: user.id }, { userBId: user.id }],
        },
        select: { userAId: true, userBId: true },
      });

      const userIdsToNotify = new Set<string>();
      for (const conv of conversations) {
        userIdsToNotify.add(conv.userAId);
        userIdsToNotify.add(conv.userBId);
      }

      const payload = {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio ?? null,
        statusMessage: user.statusMessage ?? null,
      };

      for (const partnerId of userIdsToNotify) {
        emitToUser(partnerId, 'user:updated', payload);
      }
    } catch {
      // Ignore background notification error
    }
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        themePreference: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return user;
  }

  /**
   * Update profile fields
   */
  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.statusMessage !== undefined && { statusMessage: data.statusMessage }),
        ...(data.themePreference !== undefined && { themePreference: data.themePreference }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        themePreference: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.notifyUserUpdated(user);
    return user;
  }

  /**
   * Update avatar URL
   */
  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        themePreference: true,
        createdAt: true,
      },
    });

    await this.notifyUserUpdated(user);
    return user;
  }

  /**
   * Remove avatar URL
   */
  async removeAvatar(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        themePreference: true,
        createdAt: true,
      },
    });

    await this.notifyUserUpdated(user);
    return user;
  }

  /**
   * Search users excluding current user and blocked users in both directions, with relationship status
   */
  async searchUsers(currentUserId: string, query: string) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Find all blocks involving currentUserId (either direction)
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const excludedUserIds = new Set<string>();
    excludedUserIds.add(currentUserId);
    for (const b of blocks) {
      if (b.blockerId === currentUserId) excludedUserIds.add(b.blockedId);
      if (b.blockedId === currentUserId) excludedUserIds.add(b.blockerId);
    }

    // Find up to 30 matching users
    const users = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludedUserIds) },
        OR: [
          { username: { contains: trimmed, mode: 'insensitive' } },
          { name: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        statusMessage: true,
        bio: true,
      },
      take: 30,
    });

    if (users.length === 0) {
      return [];
    }

    const targetUserIds = users.map((u) => u.id);

    // Fetch conversations between current user and target users
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { userAId: currentUserId, userBId: { in: targetUserIds } },
          { userAId: { in: targetUserIds }, userBId: currentUserId },
        ],
      },
    });

    // Map relationships
    return users.map((target) => {
      // Check conversation status
      const conv = conversations.find(
        (c) =>
          (c.userAId === currentUserId && c.userBId === target.id) ||
          (c.userAId === target.id && c.userBId === currentUserId)
      );

      if (!conv) {
        return {
          ...target,
          relationshipStatus: 'none' as RelationshipStatus,
          conversationId: undefined,
        };
      }

      let rel: RelationshipStatus = 'none';
      if (conv.status === 'accepted') {
        rel = 'accepted';
      } else if (conv.status === 'declined') {
        rel = 'declined';
      } else if (conv.status === 'pending') {
        rel = conv.requesterId === currentUserId ? 'pending_sent' : 'pending_received';
      }

      return {
        ...target,
        relationshipStatus: rel,
        conversationId: conv.id,
      };
    });
  }

  /**
   * List requests declined by current user
   */
  async getDeclinedUsers(currentUserId: string) {
    const declinedConversations = await prisma.conversation.findMany({
      where: {
        status: 'declined',
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
        requesterId: { not: currentUserId }, // The other user was the requester who was declined
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
            statusMessage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return declinedConversations.map((c) => ({
      conversationId: c.id,
      user: c.requester,
      declinedAt: c.declinedAt ?? c.createdAt,
      declineCount: c.declineCount,
    }));
  }

  /**
   * List users blocked by current user
   */
  async getBlockedUsers(currentUserId: string) {
    const blocks = await prisma.block.findMany({
      where: { blockerId: currentUserId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
            statusMessage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      user: b.blocked,
      createdAt: b.createdAt,
    }));
  }
}

export const usersService = new UsersService();
