import { z } from 'zod';

export const createProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  photo: z.string().url('Photo must be a valid URL').optional(),
  industry: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  visibility: z.enum(['private', 'employer', 'recruiter', 'public']).default('private'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  photo: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

export const visibilitySchema = z.object({
  visibility: z.enum(['private', 'employer', 'recruiter', 'public']),
});

export const slugParamSchema = z.object({
  slug: z.string().min(4).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
});

export const statsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '12m', 'all']).default('all'),
});

export const qrQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
  size: z.coerce.number().min(200).max(1200).default(300),
});
