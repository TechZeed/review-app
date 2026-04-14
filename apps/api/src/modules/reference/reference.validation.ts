import { z } from 'zod';

export const optInSchema = z.object({
  reviewId: z.string().uuid(),
  reviewerPhoneHash: z.string().min(64).max(128),
});

export const contactRequestSchema = z.object({
  referenceId: z.string().uuid(),
  companyName: z.string().min(1).max(200),
  roleTitle: z.string().min(1).max(200),
  message: z.string().min(1).max(300),
});

export const referenceIdParamSchema = z.object({
  referenceId: z.string().uuid(),
});

export const profileIdParamSchema = z.object({
  profileId: z.string().uuid(),
});
