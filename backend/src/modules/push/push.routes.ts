import { Router } from 'express';
import { pushController } from './push.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { subscribePushSchema, unsubscribePushSchema } from './push.schemas';

const router = Router();

// GET public key (can be retrieved by authenticated client)
router.get('/public-key', (req, res, next) => pushController.getPublicKey(req, res, next));

// Subscribe device for push notifications
router.post(
  '/subscribe',
  requireAuth,
  validate(subscribePushSchema),
  (req, res, next) => pushController.subscribe(req, res, next)
);

// Unsubscribe device from push notifications
router.delete(
  '/unsubscribe',
  requireAuth,
  validate(unsubscribePushSchema),
  (req, res, next) => pushController.unsubscribe(req, res, next)
);

export default router;
