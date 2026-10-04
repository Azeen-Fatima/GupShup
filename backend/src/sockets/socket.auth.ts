import { Socket } from 'socket.io';
import { verifyAccessToken, AccessTokenPayload } from '../utils/token';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AccessTokenPayload;
  };
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    let token: string | undefined;

    // 1. Check handshake auth object (primary for cross-origin WebSockets)
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    // 2. Check Authorization header
    if (!token && socket.handshake.headers.authorization) {
      const parts = socket.handshake.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    next();
  } catch (err: any) {
    next(new Error('Authentication error: Invalid or expired token'));
  }
}
