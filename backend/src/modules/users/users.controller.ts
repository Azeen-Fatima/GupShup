import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { uploadsService } from '../uploads/uploads.service';
import { sendSuccess } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';
import { presenceService } from '../presence/presence.service';

export class UsersController {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getProfile(req.user!.userId);
      sendSuccess(res, { user });
    } catch (err) {
      next(err);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.updateProfile(req.user!.userId, req.body);
      sendSuccess(res, { user });
    } catch (err) {
      next(err);
    }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No avatar file provided. Upload an image under the "file" field.', 'NO_FILE_UPLOADED');
      }

      const uploadRes = await uploadsService.uploadImage(req.file.buffer, 'gupshup/avatars', {
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face',
      });

      const user = await usersService.updateAvatar(req.user!.userId, uploadRes.url);
      sendSuccess(res, { user });
    } catch (err) {
      next(err);
    }
  }

  async removeAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.removeAvatar(req.user!.userId);
      sendSuccess(res, { user });
    } catch (err) {
      next(err);
    }
  }

  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = String(req.query.q || '');
      const users = await usersService.searchUsers(req.user!.userId, query);
      sendSuccess(res, { users });
    } catch (err) {
      next(err);
    }
  }

  async getDeclined(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const declined = await usersService.getDeclinedUsers(req.user!.userId);
      sendSuccess(res, { declined });
    } catch (err) {
      next(err);
    }
  }

  async getBlocked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blocked = await usersService.getBlockedUsers(req.user!.userId);
      sendSuccess(res, { blocked });
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = String(req.params.id);
      const user = await usersService.getProfile(targetUserId);
      const isOnline = await presenceService.isOnline(targetUserId);
      const lastSeen = await presenceService.getLastSeen(targetUserId);
      sendSuccess(res, {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          statusMessage: user.statusMessage,
          isOnline,
          lastSeen,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
