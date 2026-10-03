import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // Custom Typed AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, err.message);
    }
    return sendError(res, err.message, err.statusCode, err.code, err.details);
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
    logger.error({ err: err.message, code: err.code }, 'Prisma Database Error');
    return sendError(res, 'Database error occurred', 500, 'DATABASE_ERROR');
  }

  // Catch-all unhandled error
  logger.error({ err }, 'Unhandled Internal Server Error');
  return sendError(res, 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}
