import { Router } from 'express';
import { ReferenceController } from './reference.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  optInSchema,
  contactRequestSchema,
  referenceIdParamSchema,
  profileIdParamSchema,
} from './reference.validation.js';

export const referenceRouter = Router();
const controller = new ReferenceController();

// POST /opt-in — customer opts in after review (public, post-review flow)
referenceRouter.post(
  '/opt-in',
  validateBody(optInSchema),
  controller.optIn,
);

// DELETE /withdraw/:referenceId — customer withdraws consent (public)
referenceRouter.delete(
  '/withdraw/:referenceId',
  validateParams(referenceIdParamSchema),
  controller.withdraw,
);

// POST /request — recruiter requests to contact a reference (auth + recruiter)
referenceRouter.post(
  '/request',
  authenticate,
  requireRole(['RECRUITER']),
  validateBody(contactRequestSchema),
  controller.requestContact,
);

// GET /profile/:profileId — get references for a profile (public)
referenceRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  controller.getByProfile,
);
