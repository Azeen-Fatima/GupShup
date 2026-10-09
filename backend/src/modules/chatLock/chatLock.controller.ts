import { Request, Response, NextFunction } from 'express';
import { chatLockService } from './chatLock.service';
import { sendSuccess } from '../../utils/response';

export class ChatLockController {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await chatLockService.getStatus(req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async setPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await chatLockService.setPin(req.user!.userId, req.body.pin);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async verifyPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pin, peerUserId, conversationId } = req.body;
      const result = await chatLockService.verifyPin(
        req.user!.userId,
        pin,
        peerUserId,
        conversationId
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async toggleLock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { peerUserId, locked } = req.body;
      const result = await chatLockService.toggleLock(req.user!.userId, peerUserId, locked);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async resetPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await chatLockService.resetPin(req.user!.userId, req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async relock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = chatLockService.relock(req.user!.userId, req.body?.conversationId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

