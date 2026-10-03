import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(50, 'Name must be at most 50 characters').optional(),
  bio: z.string().trim().max(200, 'Bio must be at most 200 characters').nullable().optional(),
  statusMessage: z.string().trim().max(100, 'Status message must be at most 100 characters').nullable().optional(),
  themePreference: z.enum(['system', 'light', 'dark', 'auto']).optional(),
});

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
