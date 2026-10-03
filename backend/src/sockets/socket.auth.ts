import { Socket } from 'socket.io';
import { verifyAccessToken, AccessTokenPayload } from '../utils/token';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AccessTokenPayload;
  };
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, ...values] = pair.trim().split('=');
    if (key) acc[key] = decodeURIComponent(values.join('='));
    return acc;
  }, {} as Record<string, string>);
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    let token: string | undefined;

    // 1. Check handshake auth object
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

    // 3. Check cookies
    if (!token && socket.handshake.headers.cookie) {
      const parsedCookies = parseCookies(socket.handshake.headers.cookie);
      token = parsedCookies.accessToken;
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
