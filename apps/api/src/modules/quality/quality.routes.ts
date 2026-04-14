import { Router } from 'express';
import { QualityController } from './quality.controller.js';
import { validateParams } from '../../middleware/validate.js';
import { profileIdParamSchema } from './quality.validation.js';

export const qualityRouter = Router();
const controller = new QualityController();

// Public: List all five qualities
qualityRouter.get(
  '/',
  controller.list
);

// Public: Get quality scores for a profile
qualityRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  controller.getScoresByProfile
);
