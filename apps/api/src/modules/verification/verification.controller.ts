import { Request, Response, NextFunction } from 'express';
import { VerificationService } from './verification.service.js';
import { VerificationRepository } from './verification.repo.js';

export class VerificationController {
  private service: VerificationService;

  constructor() {
    // In production, pass actual Sequelize model:
    //   import { ReviewToken } from './verification.model.js';
    //   new VerificationRepository(ReviewToken)
    this.service = new VerificationService(new VerificationRepository(null as any));
  }

  initiate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.initiateReview(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  sendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.sendOtp(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.verifyOtp(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  validateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.validateToken(req.params.tokenId);
      if (result.valid) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };
}
