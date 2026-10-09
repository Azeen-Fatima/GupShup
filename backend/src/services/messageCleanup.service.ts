import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { uploadsService } from '../modules/uploads/uploads.service';
import { emitToUser } from '../sockets';

export async function cleanupExpiredMessages(): Promise<number> {
  const now = new Date();
  const expired = await prisma.message.findMany({
    where: {
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      conversationId: true,
      attachmentUrl: true,
    },
    take: 100,
  });

  if (expired.length === 0) return 0;

  // Cleanup Cloudinary attachments
  for (const msg of expired) {
    if (msg.attachmentUrl && msg.attachmentUrl.includes('cloudinary.com')) {
      try {
        const parts = msg.attachmentUrl.split('/upload/');
        if (parts[1]) {
          const publicIdWithExt = parts[1].replace(/^v\d+\//, '');
          const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
          await uploadsService.deleteImage(publicId);
        }
      } catch (err) {
        // Continue cleanup
      }
    }
  }

  const ids = expired.map((m) => m.id);
  await prisma.message.deleteMany({
    where: { id: { in: ids } },
  });

  // Group by conversation to notify members
  const convMap = new Map<string, string[]>();
  for (const msg of expired) {
    const list = convMap.get(msg.conversationId) || [];
    list.push(msg.id);
    convMap.set(msg.conversationId, list);
  }

  for (const [conversationId, messageIds] of convMap.entries()) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (conv) {
      for (const m of conv.members) {
        emitToUser(m.userId, 'message:expired', {
          conversationId,
          messageIds,
        });
        emitToUser(m.userId, 'conversation:updated', {
          conversationId,
        });
      }
    }
  }

  logger.info({ count: expired.length }, 'Cleaned up expired disappearing messages');
  return expired.length;
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startMessageCleanupJob(intervalMs = 30000): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupExpiredMessages().catch((err) => {
      logger.error({ err }, 'Error in message cleanup job');
    });
  }, intervalMs);
}

export function stopMessageCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
