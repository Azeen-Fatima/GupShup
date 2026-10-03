import { Router } from 'express';
import { UploadsController } from './uploads.controller';
import { requireAuth } from '../../middleware/auth';
import { uploadAttachment } from './uploads.middleware';

const router = Router();
const controller = new UploadsController();

router.post('/image', requireAuth, uploadAttachment, controller.uploadImage);

export default router;
