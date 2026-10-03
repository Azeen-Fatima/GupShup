import { redis } from '../../redis/client';
import { logger } from '../../config/logger';

export class PresenceService {
  private readonly PRESENCE_TTL_SECONDS = 45;
  private readonly TYPING_TTL_SECONDS = 4;

  /**
   * Set user as online with TTL
   */
  async setOnline(userId: string): Promise<void> {
    try {
      await redis.set(`presence:${userId}`, 'online', 'EX', this.PRESENCE_TTL_SECONDS);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to set presence in Redis');
    }
  }

  /**
   * Set user as offline and record last seen
   */
  async setOffline(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await redis.pipeline().del(`presence:${userId}`).set(`last_seen:${userId}`, now).exec();
    } catch (err) {
      logger.error({ err, userId }, 'Failed to set offline in Redis');
    }
  }

  /**
   * Check if user is online
   */
  async isOnline(userId: string): Promise<boolean> {
    try {
      const status = await redis.get(`presence:${userId}`);
      return status === 'online';
    } catch (err) {
      logger.error({ err, userId }, 'Failed to check presence in Redis');
      return false;
    }
  }

  /**
   * Get last seen timestamp (ISO string or null)
   */
  async getLastSeen(userId: string): Promise<string | null> {
    try {
      return await redis.get(`last_seen:${userId}`);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to get last seen from Redis');
      return null;
    }
  }

  /**
   * Check online status for multiple users
   */
  async getOnlineStatuses(userIds: string[]): Promise<Record<string, boolean>> {
    if (userIds.length === 0) return {};
    try {
      const pipeline = redis.pipeline();
      for (const id of userIds) {
        pipeline.get(`presence:${id}`);
      }
      const results = await pipeline.exec();
      const statusMap: Record<string, boolean> = {};

      userIds.forEach((id, idx) => {
        const res = results?.[idx]?.[1];
        statusMap[id] = res === 'online';
      });

      return statusMap;
    } catch (err) {
      logger.error({ err }, 'Failed to fetch online statuses');
      return {};
    }
  }

  /**
   * Set typing status for user in a conversation
   */
  async setTyping(conversationId: string, userId: string): Promise<void> {
    try {
      await redis.set(`typing:${conversationId}:${userId}`, '1', 'EX', this.TYPING_TTL_SECONDS);
    } catch (err) {
      logger.error({ err, conversationId, userId }, 'Failed to set typing status');
    }
  }

  /**
   * Clear typing status for user in a conversation
   */
  async clearTyping(conversationId: string, userId: string): Promise<void> {
    try {
      await redis.del(`typing:${conversationId}:${userId}`);
    } catch (err) {
      logger.error({ err, conversationId, userId }, 'Failed to clear typing status');
    }
  }
}

export const presenceService = new PresenceService();
