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

// Spec 19 B3: accept either `firebaseIdToken` (precise, matches spec 21 +
// mobile clients) or `firebaseToken` (legacy web clients). Normalised to
// `firebaseToken` downstream.
export const exchangeFirebaseTokenSchema = z
  .object({
    firebaseToken: z.string().min(1).optional(),
    firebaseIdToken: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.firebaseToken || v.firebaseIdToken), {
    message: 'firebaseIdToken (or firebaseToken) is required',
    path: ['firebaseIdToken'],
  })
  .transform((v) => ({
    firebaseToken: v.firebaseToken ?? v.firebaseIdToken!,
  }));

export const passwordLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['INDIVIDUAL', 'EMPLOYER', 'RECRUITER', 'ADMIN']),
});

export const roleRequestSchema = z.object({
  requestedRole: z.enum(['EMPLOYER', 'RECRUITER']),
  companyName: z.string().min(1, 'Company name is required').max(255),
  companyWebsite: z.string().min(1, 'Company website is required').max(255),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export const updateRoleSchema = z.object({
  role: z.enum(['INDIVIDUAL', 'EMPLOYER', 'RECRUITER', 'ADMIN']),
});

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export const roleRequestIdParamSchema = z.object({
  id: z.string().uuid('Invalid role request ID'),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});
