import { Server as HttpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { env, getAllowedOrigins } from '../config/env';
import { logger } from '../config/logger';
import { socketAuthMiddleware, AuthenticatedSocket } from './socket.auth';
import { registerSocketHandlers } from './socket.handlers';
import { prisma } from '../db/prisma';

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = getAllowedOrigins();

  const options: Partial<ServerOptions> = {
    transports: ['polling', 'websocket'],
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or tests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || (env.NODE_ENV !== 'production' && origin.includes('localhost'))) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  };

  io = new Server(httpServer, options);

  // Auth middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on('connection', (socket) => {
    registerSocketHandlers(io!, socket as AuthenticatedSocket);
  });

  logger.info('Socket.io server initialized');
  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export async function emitToConversationMembers(
  conversationId: string,
  event: string,
  data: any,
  excludeUserId?: string
): Promise<void> {
  if (!io) return;
  try {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    for (const member of members) {
      if (excludeUserId && member.userId === excludeUserId) continue;
      io.to(`user:${member.userId}`).emit(event, data);
    }
  } catch (err) {
    logger.error({ err, conversationId, event }, 'Failed to emit to conversation members');
  }
}
