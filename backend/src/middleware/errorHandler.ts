import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError, TooManyRequestsError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // TooManyRequestsError with retryAfterSeconds
  if (err instanceof TooManyRequestsError) {
    if (err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    return res.status(429).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      },
      retryAfterSeconds: err.retryAfterSeconds,
    });
  }

  // Custom Typed AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, err.message);
    }
    return sendError(res, err.message, err.statusCode, err.code, err.details);
  }

  // Multer Upload Errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const isAvatar = req.originalUrl.includes('avatar') || err.field === 'avatar';
      const message = isAvatar ? 'Photo must be smaller than 10 MB' : 'File must be smaller than 5 MB';
      return sendError(res, message, 413, 'LIMIT_FILE_SIZE');
    }
    return sendError(res, err.message || 'File upload error', 400, 'UPLOAD_ERROR');
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    const formatted = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return sendError(
      res,
      formatted[0]?.message || 'Validation error',
      400,
      'VALIDATION_ERROR',
      formatted
    );
  }

  // Prisma Known Request Error
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : 'field';
      return sendError(
        res,
        `A record with this ${target} already exists.`,
        409,
        'CONFLICT'
      );
    }
    if (err.code === 'P2025') {
      return sendError(res, 'Record not found', 404, 'NOT_FOUND');
    }
    if (err.code === 'P1001' || err.code === 'P1008' || err.code === 'P2024') {
      logger.error({ err: err.message, code: err.code }, 'Database connection/timeout error');
      return sendError(res, 'Database temporarily unavailable', 503, 'DATABASE_UNAVAILABLE');
    }
    logger.error({ err: err.message, code: err.code }, 'Prisma Database Error');
    return sendError(res, 'Database error occurred', 500, 'DATABASE_ERROR');
  }

  // Catch-all unhandled error (generic 500 without leaking internals)
  logger.error({ err: err.message || err }, 'Unhandled Internal Server Error');
  return sendError(res, 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}
