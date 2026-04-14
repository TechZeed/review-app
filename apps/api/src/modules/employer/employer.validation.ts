import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  period: z.coerce.number().int().min(7).max(365).default(30),
  groupBy: z.enum(['location']).optional(),
});

export const teamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['compositeScore', 'totalReviews', 'displayName']).default('compositeScore'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const profileIdParamSchema = z.object({
  profileId: z.string().uuid(),
});
