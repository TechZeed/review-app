import { z } from 'zod';

export const createCheckoutSchema = z.object({
  tier: z.enum([
    'pro_individual',
    'employer_small',
    'employer_medium',
    'employer_large',
    'recruiter_basic',
    'recruiter_premium',
  ]),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  locationCount: z.coerce.number().int().min(1).optional(),
  seatCount: z.coerce.number().int().min(1).optional(),
});

export const cancelSchema = z.object({
  immediate: z.boolean().default(false),
});

export const reconciliationSchema = z.object({
  consistent: z.boolean(),
  issues: z.array(z.enum(['tier-without-capability', 'orphan-capability'])),
});
