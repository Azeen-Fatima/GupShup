import { z } from 'zod';

export const createConversationSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient ID format'),
  message: z.string().trim().min(1).max(4000).optional(),
  initialMessage: z
    .union([
      z.string().trim().min(1).max(4000),
      z.object({
        type: z.enum(['text', 'image', 'file']).default('text'),
        body: z.string().trim().max(4000).optional(),
        attachmentUrl: z.string().url().optional(),
        attachmentName: z.string().optional(),
        attachmentSize: z.string().optional(),
        attachmentMime: z.string().optional(),
      }),
    ])
    .optional(),
}).refine((data) => data.message || data.initialMessage, {
  message: 'An initial message or message text is required',
  path: ['message'],
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid('Invalid conversation ID'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
