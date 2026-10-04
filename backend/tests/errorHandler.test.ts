import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../src/middleware/errorHandler';

describe('Error Handler Middleware Unit Tests', () => {
  it('maps Prisma connection and timeout errors to 503 DATABASE_UNAVAILABLE', () => {
    const codes = ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'];
    for (const code of codes) {
      const err = new Prisma.PrismaClientKnownRequestError('Connection issue', {
        code,
        clientVersion: '6.4.1',
      });
      let status = 0;
      let jsonBody: any = null;
      const res: any = {
        status: (s: number) => {
          status = s;
          return res;
        },
        json: (b: any) => {
          jsonBody = b;
          return res;
        },
      };
      const req: any = {};
      const next: any = () => {};

      errorHandler(err, req, res, next);
      expect(status).toBe(503);
      expect(jsonBody.success).toBe(false);
      expect(jsonBody.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(jsonBody.error.message).toBe('Database temporarily unavailable');
    }
  });

  it('maps PrismaClientInitializationError to 503 DATABASE_UNAVAILABLE', () => {
    const err = new Prisma.PrismaClientInitializationError('Cannot reach database', '6.4.1');
    let status = 0;
    let jsonBody: any = null;
    const res: any = {
      status: (s: number) => {
        status = s;
        return res;
      },
      json: (b: any) => {
        jsonBody = b;
        return res;
      },
    };

    errorHandler(err, {} as any, res, () => {});
    expect(status).toBe(503);
    expect(jsonBody.success).toBe(false);
    expect(jsonBody.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(jsonBody.error.message).toBe('Database temporarily unavailable');
  });
});
