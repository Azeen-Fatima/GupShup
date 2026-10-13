import webpush from 'web-push';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../db/prisma';
import { presenceService } from '../presence/presence.service';
import { SubscribePushInput } from './push.schemas';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    conversationId?: string;
    [key: string]: any;
  };
}

export class PushService {
  private isConfigured = false;

  constructor() {
    this.initVapid();
  }

  private initVapid(): void {
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
      try {
        webpush.setVapidDetails(
          env.VAPID_SUBJECT,
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY
        );
        this.isConfigured = true;
        logger.info('Web Push VAPID configuration initialized successfully');
      } catch (err) {
        logger.error({ err }, 'Failed to initialize Web Push VAPID details');
        this.isConfigured = false;
      }
    } else {
      logger.info('Web Push VAPID keys not provided; push notifications disabled');
      this.isConfigured = false;
    }
  }

  /**
   * Get the VAPID public key for frontend subscription
   */
  getPublicKey(): string | null {
    return env.VAPID_PUBLIC_KEY || null;
  }

  /**
   * Save or update a push subscription for a user
   */
  async subscribe(userId: string, data: SubscribePushInput): Promise<void> {
    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint: data.endpoint },
        create: {
          userId,
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userAgent: data.userAgent || null,
        },
        update: {
          userId,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userAgent: data.userAgent || null,
        },
      });
      logger.info({ userId }, 'Push subscription saved successfully');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to save push subscription');
      throw err;
    }
  }

  /**
   * Unsubscribe push subscription(s) for a user
   */
  async unsubscribe(userId: string, endpoint?: string): Promise<void> {
    try {
      if (endpoint) {
        await prisma.pushSubscription.deleteMany({
          where: { userId, endpoint },
        });
      } else {
        await prisma.pushSubscription.deleteMany({
          where: { userId },
        });
      }
      logger.info({ userId, endpoint }, 'Push subscription(s) removed');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to remove push subscription');
    }
  }

  /**
   * Dispatch push notification to all active devices of a user
   */
  async sendNotificationToUser(userId: string, payload: PushNotificationPayload): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (subscriptions.length === 0) {
        return;
      }

      const icon = payload.icon || '/icons/icon-192x192.png';
      const badge = payload.badge || '/icons/icon-192x192.png';
      const url = payload.data?.url || '/';

      // Standard payload structured for Angular ngsw-worker.js and web standards
      const stringifiedPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon,
        badge,
        tag: payload.tag,
        data: {
          ...payload.data,
          url,
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url,
            },
          },
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon,
          badge,
          tag: payload.tag,
          data: {
            ...payload.data,
            url,
            onActionClick: {
              default: {
                operation: 'navigateLastFocusedOrOpen',
                url,
              },
            },
          },
        },
      });

      const promises = subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            stringifiedPayload
          );
        } catch (err: any) {
          // If subscription is expired / unsubscribed (404 / 410 Gone / NotRegistered)
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            logger.info({ endpoint: sub.endpoint }, 'Push subscription expired; cleaning up from DB');
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            logger.warn({ err: err?.message, statusCode: err?.statusCode }, 'Failed to send web push notification');
          }
        }
      });

      await Promise.allSettled(promises);
    } catch (err) {
      logger.error({ err, userId }, 'Unexpected error in sendNotificationToUser');
    }
  }

  /**
   * Helper: Push for a new message
   */
  async notifyNewMessage(params: {
    conversationId: string;
    sender: { id: string; name: string };
    recipientId: string;
    type?: string;
    body?: string | null;
    isLocked?: boolean;
  }): Promise<void> {
    const { conversationId, sender, recipientId, type, body, isLocked } = params;

    // Do not notify self
    if (recipientId === sender.id) return;

    // Skip push if recipient is online AND actively viewing this conversation
    const isOnline = await presenceService.isOnline(recipientId);
    if (isOnline) {
      const isViewing = await presenceService.isViewingConversation(recipientId, conversationId);
      if (isViewing) {
        return;
      }
    }

    // Skip push if recipient has blocked sender or sender has blocked recipient
    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: recipientId, blockedId: sender.id },
          { blockerId: sender.id, blockedId: recipientId },
        ],
      },
    });
    if (blockExists) return;

    let title: string;
    let messageText: string;

    if (isLocked) {
      // Locked chat privacy: generic without sender name or message text
      title = 'Gupshup';
      messageText = 'You have a new message';
    } else {
      title = sender.name || 'Gupshup';
      if (type === 'image') {
        messageText = 'Photo';
      } else if (type === 'file') {
        messageText = 'File';
      } else {
        const text = (body || '').trim();
        messageText = text.length > 80 ? text.substring(0, 80) + '…' : (text || 'New message');
      }
    }

    await this.sendNotificationToUser(recipientId, {
      title,
      body: messageText,
      tag: conversationId,
      data: {
        url: `/chats/${conversationId}`,
        conversationId,
      },
    });
  }

  /**
   * Helper: Push for new message request
   */
  async notifyMessageRequest(params: {
    conversationId: string;
    sender: { id: string; name: string };
    recipientId: string;
  }): Promise<void> {
    const { conversationId, sender, recipientId } = params;
    if (recipientId === sender.id) return;

    const isOnline = await presenceService.isOnline(recipientId);
    if (isOnline) {
      const isViewing = await presenceService.isViewingConversation(recipientId, conversationId);
      if (isViewing) return;
    }

    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: recipientId, blockedId: sender.id },
          { blockerId: sender.id, blockedId: recipientId },
        ],
      },
    });
    if (blockExists) return;

    await this.sendNotificationToUser(recipientId, {
      title: 'New message request',
      body: `${sender.name} sent you a message request`,
      tag: conversationId,
      data: {
        url: `/chats/${conversationId}`,
        conversationId,
      },
    });
  }

  /**
   * Helper: Push for request accepted
   */
  async notifyRequestAccepted(params: {
    conversationId: string;
    otherUser: { id: string; name: string };
    recipientId: string;
  }): Promise<void> {
    const { conversationId, otherUser, recipientId } = params;
    if (recipientId === otherUser.id) return;

    const isOnline = await presenceService.isOnline(recipientId);
    if (isOnline) {
      const isViewing = await presenceService.isViewingConversation(recipientId, conversationId);
      if (isViewing) return;
    }

    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: recipientId, blockedId: otherUser.id },
          { blockerId: otherUser.id, blockedId: recipientId },
        ],
      },
    });
    if (blockExists) return;

    await this.sendNotificationToUser(recipientId, {
      title: 'Request accepted',
      body: `${otherUser.name} accepted your message request`,
      tag: conversationId,
      data: {
        url: `/chats/${conversationId}`,
        conversationId,
      },
    });
  }

  /**
   * Helper: Push for request declined
   */
  async notifyRequestDeclined(params: {
    conversationId: string;
    otherUser: { id: string; name: string };
    recipientId: string;
  }): Promise<void> {
    const { conversationId, otherUser, recipientId } = params;
    if (recipientId === otherUser.id) return;

    const isOnline = await presenceService.isOnline(recipientId);
    if (isOnline) {
      const isViewing = await presenceService.isViewingConversation(recipientId, conversationId);
      if (isViewing) return;
    }

    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: recipientId, blockedId: otherUser.id },
          { blockerId: otherUser.id, blockedId: recipientId },
        ],
      },
    });
    if (blockExists) return;

    await this.sendNotificationToUser(recipientId, {
      title: 'Request declined',
      body: `${otherUser.name} declined your message request`,
      tag: conversationId,
      data: {
        url: `/chats/${conversationId}`,
        conversationId,
      },
    });
  }
}

export const pushService = new PushService();
