import { Router } from 'express';
import { ReviewController } from './review.controller.js';
import { MediaController } from '../media/media.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { reviewRateLimit } from '../../middleware/rateLimit.js';
import { reviewMediaParamSchema, reviewMediaTextSchema } from '../media/media.validation.js';
import {
  scanSchema,
  submitReviewSchema,
  slugParamSchema,
  profileIdParamSchema,
  reviewsQuerySchema,
} from './review.validation.js';

export const reviewRouter = Router();
const controller = new ReviewController();
const mediaController = new MediaController();

// Public: Scan QR code to start review session
reviewRouter.post(
  '/scan/:slug',
  reviewRateLimit,
  validateParams(slugParamSchema),
  validateBody(scanSchema),
  controller.scan
);

// Public: Submit a review (after OTP verification)
reviewRouter.post(
  '/submit',
  reviewRateLimit,
  validateBody(submitReviewSchema),
  controller.submit
);

// Public: add scanner media to a just-submitted review (text only for now)
reviewRouter.post(
  '/:reviewId/media',
  validateParams(reviewMediaParamSchema),
  validateBody(reviewMediaTextSchema),
  mediaController.uploadForReview
);

// IMPORTANT: /me and /my-submissions routes must be registered BEFORE /profile/:profileId

// Public: reviews the current device has submitted (customer history, spec 19).
reviewRouter.get(
  '/my-submissions',
  controller.mySubmissions
);

// Protected: Get reviews received by the authenticated individual
reviewRouter.get(
  '/me',
  authenticate,
  requireRole(['INDIVIDUAL']),
  validateQuery(reviewsQuerySchema),
  controller.getMyReviews
);

// Public: Get reviews for a profile
reviewRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  validateQuery(reviewsQuerySchema),
  controller.getByProfile
);
