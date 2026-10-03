import { Request, Response, NextFunction } from 'express';
import { conversationsService } from './conversations.service';
import { sendSuccess } from '../../utils/response';

export class ConversationsController {
  async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversations = await conversationsService.getUserConversations(req.user!.userId);
      sendSuccess(res, { conversations });
    } catch (err) {
      next(err);
    }
  }

  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const conversation = await conversationsService.getConversationById(convId, req.user!.userId);
      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  }

  async createConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await conversationsService.createOrGetConversation(req.user!.userId, req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async acceptConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const conversation = await conversationsService.acceptConversation(convId, req.user!.userId);
      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  }

  async declineConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const conversation = await conversationsService.declineConversation(convId, req.user!.userId);
      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  }

  async blockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const result = await conversationsService.blockConversationUser(convId, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async unblockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const result = await conversationsService.unblockConversationUser(convId, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async clearHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const result = await conversationsService.clearHistory(convId, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const convId = String(req.params.id);
      const result = await conversationsService.hideConversation(convId, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
