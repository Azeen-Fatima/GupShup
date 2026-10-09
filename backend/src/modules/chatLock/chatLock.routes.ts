import { Router } from 'express';
import { ChatLockController } from './chatLock.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  setPinSchema,
  verifyPinSchema,
  toggleChatLockSchema,
  resetPinSchema,
} from './chatLock.schemas';

const router = Router();
const controller = new ChatLockController();

router.use(requireAuth);

router.get('/status', controller.getStatus);
router.post('/pin', validate(setPinSchema), controller.setPin);
router.post('/verify', validate(verifyPinSchema), controller.verifyPin);
router.post('/toggle', validate(toggleChatLockSchema), controller.toggleLock);
router.post('/reset-pin', validate(resetPinSchema), controller.resetPin);

export default router;
