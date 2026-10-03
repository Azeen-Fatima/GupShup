import { z } from 'zod';

export const sendMessageSchema = z
  .object({
    type: z.enum(['text', 'image', 'file']).default('text'),
    body: z.string().trim().max(4000).optional(),
    attachmentUrl: z.string().url().optional(),
    attachmentName: z.string().optional(),
    attachmentSize: z.string().optional(),
    attachmentMime: z.string().optional(),
  })
  .refine((data) => (data.body && data.body.length > 0) || data.attachmentUrl, {
    message: 'Message must have either a text body or an attachment URL',
    path: ['body'],
  });

export const getMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesQueryInput = z.infer<typeof getMessagesQuerySchema>;
