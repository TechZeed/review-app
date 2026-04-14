import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate.js';
import { ProfileService } from './profile.service.js';
import { ProfileRepo } from './profile.repo.js';
import { QrService } from './qr.service.js';

export class ProfileController {
  private service: ProfileService;
  private qrService: QrService;

  constructor() {
    this.service = new ProfileService(new ProfileRepo());
    this.qrService = new QrService();
  }

  /**
   * Create a new profile
   * POST /api/v1/profiles
   */
  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createProfile(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get profile by slug (public)
   * GET /api/v1/profiles/:slug
   */
  getBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getBySlug(req.params.slug as string);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get own profile
   * GET /api/v1/profiles/me
   */
  getOwn = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMyProfile(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update own profile
   * PUT /api/v1/profiles/me
   */
  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateProfile(req.user!.id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update profile visibility
   * PATCH /api/v1/profiles/me/visibility
   */
  updateVisibility = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateVisibility(req.user!.id, req.body.visibility);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get QR code image for the authenticated user's profile
   * GET /api/v1/profiles/me/qr
   */
  getQrCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const profile = await this.service.getMyProfile(req.user!.id);
      const format = (req.query.format as string) ?? 'png';
      const size = Number(req.query.size) || 300;

      if (format === 'svg') {
        const svg = await this.qrService.generateQrSvg(profile.slug);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
      } else {
        const buffer = await this.qrService.generateQrCode(profile.slug, size);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="${profile.slug}-qr.png"`);
        res.send(buffer);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get quality stats for own profile
   * GET /api/v1/profiles/me/stats
   */
  getStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getQualityStats(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
