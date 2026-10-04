import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, getAllowedOrigins } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import { redis } from './redis/client';
import { globalRateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/errors';
import { sendSuccess } from './utils/response';

import authRouter from './modules/auth/auth.routes';
import usersRouter from './modules/users/users.routes';
import conversationsRouter from './modules/conversations/conversations.routes';
import uploadsRouter from './modules/uploads/uploads.routes';

const app = express();

// Trust proxy for Render / load balancers
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || (env.NODE_ENV !== 'production' && origin.includes('localhost'))) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Parsers
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });
    next();
  });
}

// Global rate limiter
app.use(globalRateLimiter);

// Health check endpoint
const healthHandler = async (_req: Request, res: Response) => {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'unhealthy';
  }

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') redisStatus = 'unhealthy';
  } catch (err) {
    redisStatus = 'unhealthy';
  }

  const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      cloudinary: env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not_configured',
      googleAuth: env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured',
    },
  });
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// API v1 routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/conversations', conversationsRouter);
app.use('/api/v1/uploads', uploadsRouter);

// 404 handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
});

// Central error handler
app.use(errorHandler);

export { app };
