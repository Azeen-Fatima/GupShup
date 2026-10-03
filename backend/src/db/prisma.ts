import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

if (env.NODE_ENV === 'development') {
  (prisma as any).$on?.('query', (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, 'Prisma Query');
  });
}

(prisma as any).$on?.('error', (e: any) => {
  logger.error({ error: e.message }, 'Prisma Error');
});

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
