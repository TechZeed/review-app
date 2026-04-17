import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { AuthRequest } from '../../middleware/authenticate.js';
import { ReviewService } from './review.service.js';
import { ReviewRepo } from './review.repo.js';
import { ProfileRepo } from '../profile/profile.repo.js';

// Spec 19 B1: derive a stable-enough server-side fingerprint when the
// client didn't send one. SHA-256(UA + IP) is what the existing rate
// limiter keys on anyway.
function deriveFingerprint(req: Request): string {
  const ua = String(req.headers['user-agent'] ?? '');
  const ip = req.ip ?? '';
  return crypto.createHash('sha256').update(`${ua}|${ip}`).digest('hex');
}

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
      const body = {
        ...req.body,
        deviceFingerprint: req.body.deviceFingerprint || deriveFingerprint(req),
      };
      const result = await this.service.scanProfile(req.params.slug as string, body);
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
   * Customer-side history — reviews the current device has submitted.
   * GET /api/v1/reviews/my-submissions?deviceFingerprint=...
   * If the client omits the fingerprint it's derived from UA+IP (same
   * B1 fallback as scan).
   */
  mySubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fp = String(req.query.deviceFingerprint ?? '') || deriveFingerprint(req);
      const result = await this.service.getMySubmissions(fp, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json(result);
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
