import { z } from 'zod';

export const qualityEnum = z.enum(['expertise', 'care', 'delivery', 'initiative', 'trust']);

export const slugParamSchema = z.object({
  slug: z.string().min(4).max(50),
});

// Spec 19 B1: deviceFingerprint is optional. Controller falls back to a
// SHA-256 of (User-Agent + req.ip) when the client omits it, so mobile
// and web clients both work without knowing the server's expectations.
export const scanSchema = z.object({
  deviceFingerprint: z.string().min(16).max(128).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  userAgent: z.string().max(500).optional(),
});

export const submitReviewSchema = z.object({
  reviewToken: z.string().uuid('Review token must be a valid UUID'),
  qualities: z.array(qualityEnum).min(1, 'At least 1 quality pick is required').max(2, 'Maximum 2 quality picks allowed'),
  qualityDisplayOrder: z.array(qualityEnum).length(5, 'Must include all 5 qualities in display order'),
  thumbsUp: z.literal(true, { errorMap: () => ({ message: 'Thumbs up is required' }) }),
  phoneHash: z.string().min(16).optional(),
  optInVerifiable: z.boolean().default(false),
});

export const profileIdParamSchema = z.object({
  profileId: z.string().uuid('Profile ID must be a valid UUID'),
});

export const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  quality: qualityEnum.optional(),
  mediaType: z.enum(['text', 'voice', 'video']).optional(),
  badgeTier: z.enum(['basic', 'verified', 'verified_interaction', 'verified_testimonial']).optional(),
  sortBy: z.enum(['recent', 'badgeTier']).default('recent'),
});
