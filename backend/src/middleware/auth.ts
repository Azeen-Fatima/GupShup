import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/token';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../db/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication token required', 'NO_TOKEN'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Authentication token missing', 'EMPTY_TOKEN'));
  }

  try {
    const payload = verifyAccessToken(token);

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true },
    });

    if (!user) {
      return next(new UnauthorizedError('User account not found', 'USER_NOT_FOUND'));
    }

    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username,
    };

    next();
  } catch (err) {
    next(err);
  }
}
