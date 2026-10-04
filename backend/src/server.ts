import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSocketServer } from './sockets';
import { prisma } from './db/prisma';
import { redis } from './redis/client';
import { logActiveEmailProvider } from './utils/mailer';

const server = http.createServer(app);

// Initialize Socket.io
initSocketServer(server);

// Log active email provider at startup
logActiveEmailProvider();

// Start server
server.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`Gupshup backend server running on http://0.0.0.0:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  // Force close after 10 seconds if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, force terminating');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await redis.quit();
      logger.info('Redis client disconnected');
    } catch (err) {
      logger.error({ err }, 'Error closing Redis client');
    }

    try {
      await prisma.$disconnect();
      logger.info('Prisma client disconnected');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting Prisma');
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  process.exit(1);
});
