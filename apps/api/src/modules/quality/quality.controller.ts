import { Request, Response, NextFunction } from 'express';
import { QualityService } from './quality.service.js';
import { QualityRepo } from './quality.repo.js';
import { ProfileRepo } from '../profile/profile.repo.js';

export class QualityController {
  private service: QualityService;

  constructor() {
    this.service = new QualityService(new QualityRepo(), new ProfileRepo());
  }

  /**
   * List all qualities
   * GET /api/v1/qualities
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qualities = await this.service.listQualities();
      res.json({ qualities });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get quality scores for a profile
   * GET /api/v1/qualities/profile/:profileId
   */
  getScoresByProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scores = await this.service.getScoresByProfile(req.params.profileId as string);
      res.json({ scores });
    } catch (error) {
      next(error);
    }
  };
}
