import { z } from 'zod';

export const subscribePushSchema = z.object({
  endpoint: z.string().url('A valid URL endpoint is required'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth key is required'),
  }),
  userAgent: z.string().optional(),
});

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url().optional(),
});

export type SubscribePushInput = z.infer<typeof subscribePushSchema>;
export type UnsubscribePushInput = z.infer<typeof unsubscribePushSchema>;
