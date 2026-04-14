import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate.js';
import { ReviewService } from './review.service.js';
import { ReviewRepo } from './review.repo.js';
import { ProfileRepo } from '../profile/profile.repo.js';

export class ReviewController {
  private service: ReviewService;

  constructor() {
    this.service = new ReviewService(new ReviewRepo(), new ProfileRepo());
  }

  /**
   * Scan QR code to initiate a review session
   * POST /api/v1/reviews/scan/:slug
   */
  scan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.scanProfile(req.params.slug as string, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Submit a review
   * POST /api/v1/reviews/submit
   */
  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.submitReview(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get reviews by profile (public, paginated)
   * GET /api/v1/reviews/profile/:profileId
   */
  getByProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getReviewsByProfile(req.params.profileId as string, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: (req.query.sortBy as string) ?? 'recent',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get reviews received by the authenticated individual
   * GET /api/v1/reviews/me
   */
  getMyReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMyReviews(req.user!.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: (req.query.sortBy as string) ?? 'recent',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
