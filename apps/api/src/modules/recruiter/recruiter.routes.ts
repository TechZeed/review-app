import { Router } from 'express';
import { RecruiterController } from './recruiter.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  searchSchema,
  contactRequestSchema,
  profileIdParamSchema,
} from './recruiter.validation.js';

export const recruiterRouter = Router();
const controller = new RecruiterController();

// All routes require auth + recruiter role (applied at app.ts level)

// POST /search — search profiles with filters
recruiterRouter.post(
  '/search',
  validateBody(searchSchema),
  controller.search,
);

// GET /profile/:profileId — view a profile (logs the view)
recruiterRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  controller.viewProfile,
);

// POST /contact/:profileId — send a contact request
recruiterRouter.post(
  '/contact/:profileId',
  validateParams(profileIdParamSchema),
  validateBody(contactRequestSchema),
  controller.requestContact,
);

// GET /history — get contact request history
recruiterRouter.get(
  '/history',
  controller.getHistory,
);
