import { z } from 'zod';

const qualityEnum = z.enum(['expertise', 'care', 'delivery', 'initiative', 'trust']);

export const searchSchema = z.object({
  query: z.string().max(200).optional(),
  industries: z.array(z.string().max(100)).optional(),
  location: z.string().max(200).optional(),
  qualities: z.array(z.object({
    quality: qualityEnum,
    minPercentage: z.number().min(0).max(100),
  })).optional(),
  minReviewCount: z.coerce.number().int().min(0).optional(),
  activeInLastMonths: z.coerce.number().int().min(1).max(24).optional(),
  minVerifiedRate: z.coerce.number().min(0).max(100).optional(),
  hasVideo: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const contactRequestSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  hiringRole: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
});

export const profileIdParamSchema = z.object({
  profileId: z.string().uuid(),
});
