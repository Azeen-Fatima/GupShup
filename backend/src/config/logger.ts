import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:HH:MM:ss',
          },
        }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'currentPassword',
      'newPassword',
      'token',
      'refreshToken',
      'signupToken',
    ],
    remove: true,
  },
});
