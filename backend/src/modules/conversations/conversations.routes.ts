import { Router } from 'express';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from '../messages/messages.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createConversationSchema,
  conversationIdParamSchema,
  setDisappearingModeSchema,
} from './conversations.schemas';
import {
  sendMessageSchema,
  getMessagesQuerySchema,
} from '../messages/messages.schemas';

const router = Router();
const convController = new ConversationsController();
const msgController = new MessagesController();

router.use(requireAuth);

// Conversation list and create
router.get('/', convController.getConversations);
router.post('/', validate(createConversationSchema), convController.createConversation);

// Single conversation actions
router.get('/:id', validate(conversationIdParamSchema, 'params'), convController.getConversation);
router.post('/:id/accept', validate(conversationIdParamSchema, 'params'), convController.acceptConversation);
router.post('/:id/decline', validate(conversationIdParamSchema, 'params'), convController.declineConversation);
router.post('/:id/block', validate(conversationIdParamSchema, 'params'), convController.blockUser);
router.post('/:id/unblock', validate(conversationIdParamSchema, 'params'), convController.unblockUser);
router.post('/:id/clear', validate(conversationIdParamSchema, 'params'), convController.clearHistory);
router.delete('/:id', validate(conversationIdParamSchema, 'params'), convController.deleteConversation);
router.patch(
  '/:id/disappearing',
  validate(conversationIdParamSchema, 'params'),
  validate(setDisappearingModeSchema),
  convController.setDisappearingMode
);

// Message actions within conversation
router.get(
  '/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  validate(getMessagesQuerySchema, 'query'),
  msgController.getMessages
);
router.post(
  '/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  validate(sendMessageSchema),
  msgController.sendMessage
);
router.post(
  '/:id/seen',
  validate(conversationIdParamSchema, 'params'),
  msgController.markSeen
);

export default router;
