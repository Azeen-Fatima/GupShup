import { Request, Response, NextFunction } from 'express';
import { pushService } from './push.service';
import { sendSuccess } from '../../utils/response';

export class PushController {
  async getPublicKey(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicKey = pushService.getPublicKey();
      sendSuccess(res, { publicKey });
    } catch (err) {
      next(err);
    }
  }

  async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await pushService.subscribe(userId, req.body);
      sendSuccess(res, { success: true, message: 'Push subscription registered' }, 201);
    } catch (err) {
      next(err);
    }
  }

  async unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const endpoint = (req.body?.endpoint as string) || (req.query?.endpoint as string);
      await pushService.unsubscribe(userId, endpoint);
      sendSuccess(res, { success: true, message: 'Push subscription removed' });
    } catch (err) {
      next(err);
    }
  }
}

export const pushController = new PushController();
