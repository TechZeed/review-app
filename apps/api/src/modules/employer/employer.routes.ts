import { Router } from 'express';
import { EmployerController } from './employer.controller.js';
import { validateQuery, validateParams } from '../../middleware/validate.js';
import {
  dashboardQuerySchema,
  teamQuerySchema,
  profileIdParamSchema,
} from './employer.validation.js';

export const employerRouter = Router();
const controller = new EmployerController();

// All routes require auth + employer role (applied at app.ts level)

// GET /dashboard — aggregated team metrics
employerRouter.get(
  '/dashboard',
  validateQuery(dashboardQuerySchema),
  controller.getDashboard,
);

// GET /team — list team members with scores
employerRouter.get(
  '/team',
  validateQuery(teamQuerySchema),
  controller.getTeam,
);

// GET /team/top — top performers leaderboard
employerRouter.get(
  '/team/top',
  controller.getTopPerformers,
);

// GET /team/retention — retention risk signals
employerRouter.get(
  '/team/retention',
  controller.getRetentionSignals,
);

// GET /team/:profileId — single team member detail
employerRouter.get(
  '/team/:profileId',
  validateParams(profileIdParamSchema),
  controller.getTeamMember,
);
