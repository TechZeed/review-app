import { z } from 'zod';

export const uploadMediaSchema = z.object({
  reviewToken: z.string().uuid(),
  reviewId: z.string().uuid(),
  mediaType: z.enum(['text', 'voice', 'video']),
  textContent: z.string().max(280).optional(),
});

export const uploadTextSchema = z.object({
  reviewToken: z.string().uuid(),
  reviewId: z.string().uuid(),
  mediaType: z.literal('text'),
  textContent: z.string().min(1).max(280),
});

export const mediaIdParamSchema = z.object({
  mediaId: z.string().uuid(),
});
