import { Request, Response, NextFunction } from 'express';
import { VerificationService } from './verification.service.js';
import { VerificationRepository } from './verification.repo.js';
import { ReviewToken } from './verification.model.js';

export class VerificationController {
  private service: VerificationService;

  constructor() {
    this.service = new VerificationService(new VerificationRepository(ReviewToken));
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
      const result = await this.service.validateToken(req.params.tokenId as string);
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
