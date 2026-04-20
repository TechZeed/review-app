import { Router } from 'express';
import { ProfileController } from './profile.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  createProfileSchema,
  updateProfileSchema,
  visibilitySchema,
  slugParamSchema,
  statsQuerySchema,
  qrQuerySchema,
} from './profile.validation.js';

export const profileRouter = Router();
const controller = new ProfileController();

// Create profile (auth + individual role)
profileRouter.post(
  '/',
  authenticate,
  requireRole(['INDIVIDUAL']),
  validateBody(createProfileSchema),
  auditLog('profile_created', 'profile'),
  controller.create
);

// IMPORTANT: /me routes must be registered BEFORE /:slug to avoid "me" being treated as a slug

// Get own profile
profileRouter.get(
  '/me',
  authenticate,
  controller.getOwn
);

// Update own profile
profileRouter.put(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  auditLog('profile_updated', 'profile'),
  controller.update
);

// Update visibility
profileRouter.patch(
  '/me/visibility',
  authenticate,
  validateBody(visibilitySchema),
  auditLog('visibility_changed', 'profile'),
  controller.updateVisibility
);

// Get QR code image
profileRouter.get(
  '/me/qr',
  authenticate,
  validateQuery(qrQuerySchema),
  controller.getQrCode
);

// Get quality stats
profileRouter.get(
  '/me/stats',
  authenticate,
  validateQuery(statsQuerySchema),
  controller.getStats
);

// Public: get profile by slug
profileRouter.get(
  '/:slug',
  validateParams(slugParamSchema),
  controller.getBySlug
);
