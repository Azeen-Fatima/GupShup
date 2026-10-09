import { z } from 'zod';

export const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  peerUserId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

export const toggleChatLockSchema = z.object({
  peerUserId: z.string().uuid(),
  locked: z.boolean().optional(),
});

export const resetPinSchema = z.object({
  newPin: z.string().regex(/^\d{4}$/, 'New PIN must be exactly 4 digits'),
  password: z.string().optional(),
  idToken: z.string().optional(),
});

export type SetPinInput = z.infer<typeof setPinSchema>;
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
export type ToggleChatLockInput = z.infer<typeof toggleChatLockSchema>;
export type ResetPinInput = z.infer<typeof resetPinSchema>;
