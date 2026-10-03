import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  messageOrStatusCode: string | number = 200,
  statusCode = 200
): Response {
  let message: string | undefined;
  let code = 200;

  if (typeof messageOrStatusCode === 'number') {
    code = messageOrStatusCode;
  } else if (typeof messageOrStatusCode === 'string') {
    message = messageOrStatusCode;
    code = statusCode;
  }

  const payload: ApiResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
  return res.status(code).json(payload);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { nextCursor?: string | null; hasMore: boolean; [key: string]: unknown },
  statusCode = 200
): Response {
  const payload: ApiResponse<T[]> = {
    success: true,
    data,
    meta,
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  code = 'INTERNAL_SERVER_ERROR',
  details?: unknown
): Response {
  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return res.status(statusCode).json(payload);
}
