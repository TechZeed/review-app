import { z } from 'zod';

export const qualityPicksSchema = z.object({
  qualities: z
    .array(z.enum(['expertise', 'care', 'delivery', 'initiative', 'trust']))
    .min(1, 'At least 1 quality pick is required')
    .max(2, 'Maximum 2 quality picks allowed'),
});

export const profileIdParamSchema = z.object({
  profileId: z.string().uuid('Profile ID must be a valid UUID'),
});
