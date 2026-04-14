import { Router } from 'express';
import { OrganizationController } from './organization.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import {
  createOrgSchema,
  tagSchema,
  orgIdParamSchema,
  profileOrgIdParamSchema,
  profileIdParamSchema,
  teamQuerySchema,
} from './organization.validation.js';

export const organizationRouter = Router();
const controller = new OrganizationController();

// All routes require authentication
organizationRouter.use(authenticate);

// POST / — Create organization (employer or admin)
organizationRouter.post(
  '/',
  requireRole(['employer', 'admin']),
  validateBody(createOrgSchema),
  controller.create,
);

// POST /tag — Tag a profile to an organization
organizationRouter.post(
  '/tag',
  requireRole(['individual', 'employer']),
  validateBody(tagSchema),
  controller.tag,
);

// DELETE /untag/:profileOrgId — Untag a profile from an organization
organizationRouter.delete(
  '/untag/:profileOrgId',
  requireRole(['individual', 'employer']),
  validateParams(profileOrgIdParamSchema),
  controller.untag,
);

// GET /profile/:profileId — Get organizations for a profile
// Must be before /:id to prevent "profile" matching as :id
organizationRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  controller.getByProfile,
);

// GET /me/team — Get team members for employer's org
// Must be before /:id to prevent "me" matching as :id
organizationRouter.get(
  '/me/team',
  requireRole(['employer']),
  validateQuery(teamQuerySchema),
  controller.getTeam,
);

// GET /:id/members — Get members of an organization (employer)
organizationRouter.get(
  '/:id/members',
  requireRole(['employer', 'admin']),
  validateParams(orgIdParamSchema),
  controller.getMembers,
);

// GET /:id — Get organization by ID (must be last to avoid catching other paths)
organizationRouter.get(
  '/:id',
  validateParams(orgIdParamSchema),
  controller.getById,
);
