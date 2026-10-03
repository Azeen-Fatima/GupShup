import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis =
  global.__redis ||
  new Redis(env.REDIS_URL, {
    tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

redis.on('connect', () => {
  logger.info('Connected to Redis (Upstash)');
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis error');
});

if (env.NODE_ENV !== 'production') {
  global.__redis = redis;
}
