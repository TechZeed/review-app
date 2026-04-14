import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['individual', 'recruiter', 'employer']),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format').optional(),
  firebaseToken: z.string().min(1, 'Firebase token is required'),
  industry: z.string().max(100).optional(),
  organizationName: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  firebaseToken: z.string().min(1, 'Firebase token is required'),
});
