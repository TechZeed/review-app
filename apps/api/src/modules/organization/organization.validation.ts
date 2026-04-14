import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(2).max(200),
  industry: z.string().max(100),
  website: z.string().url().optional(),
  location: z.object({
    city: z.string().max(100),
    state: z.string().max(100).optional(),
    country: z.string().length(2),
  }),
  size: z.enum(['1-25', '26-100', '101-500', '500+']).optional(),
});

export const tagSchema = z.object({
  profileId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  role: z.string().max(100),
});

export const orgIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const profileOrgIdParamSchema = z.object({
  profileOrgId: z.string().uuid(),
});

export const profileIdParamSchema = z.object({
  profileId: z.string().uuid(),
});

export const teamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['name', 'reviewCount', 'qualityScore']).default('name'),
  quality: z.enum(['expertise', 'care', 'delivery', 'initiative', 'trust']).optional(),
});
