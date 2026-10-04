export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: unknown) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', details?: unknown) {
    super(message, 404, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
    super(message, 409, code, details);
  }
}

export class TooManyRequestsError extends AppError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message = 'Too many requests, please try again later',
    code = 'TOO_MANY_REQUESTS',
    details?: unknown,
    retryAfterSeconds?: number
  ) {
    super(message, 429, code, details);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service not configured or unavailable', code = 'SERVICE_UNAVAILABLE', details?: unknown) {
    super(message, 503, code, details);
  }
}
