import { Request, Response, NextFunction } from 'express';
import { messagesService } from './messages.service';
import { sendSuccess } from '../../utils/response';

export class MessagesController {
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const result = await messagesService.getConversationMessages(
        convId,
        req.user!.userId,
        req.query as any
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const message = await messagesService.sendMessage(
        convId,
        req.user!.userId,
        req.body
      );
      sendSuccess(res, { message }, 201);
    } catch (err) {
      next(err);
    }
  }

  async markSeen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const result = await messagesService.markSeen(convId, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
