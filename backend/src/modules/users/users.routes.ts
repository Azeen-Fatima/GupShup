import { Router } from 'express';
import { UsersController } from './users.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateProfileSchema, searchUsersQuerySchema } from './users.schemas';
import { uploadAvatar } from '../uploads/uploads.middleware';

const router = Router();
const controller = new UsersController();

router.use(requireAuth);

router.get('/me', controller.getMe);
router.patch('/me', validate(updateProfileSchema), controller.updateMe);
router.post('/me/avatar', uploadAvatar, controller.uploadAvatar);
router.delete('/me/avatar', controller.removeAvatar);

router.get('/search', validate(searchUsersQuerySchema, 'query'), controller.searchUsers);
router.get('/me/declined', controller.getDeclined);
router.get('/me/blocked', controller.getBlocked);

export default router;
