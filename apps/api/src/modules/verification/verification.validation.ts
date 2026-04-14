import { z } from 'zod';

export const initiateSchema = z.object({
  slug: z.string().min(4).max(50),
  deviceFingerprint: z.string().min(16).max(128),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().min(0).optional(),
  userAgent: z.string().max(500).optional(),
});

export const sendOtpSchema = z.object({
  reviewToken: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

export const verifyOtpSchema = z.object({
  reviewToken: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().length(6).regex(/^\d{6}$/),
});

export const tokenIdParamSchema = z.object({
  tokenId: z.string().uuid(),
});

export const validateTokenSchema = z.object({
  tokenId: z.string().uuid(),
});
