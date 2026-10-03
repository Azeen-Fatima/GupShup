import { Request, Response, NextFunction } from 'express';
import { uploadsService } from './uploads.service';
import { sendSuccess } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';

export class UploadsController {
  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded. Please upload a file in the "file" field.', 'NO_FILE_UPLOADED');
      }

      const result = await uploadsService.uploadImage(req.file.buffer, 'gupshup/messages', {
        width: 1920,
        height: 1080,
        crop: 'limit',
      });

      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
}
