import { Request, Response, NextFunction } from 'express';
import { RecruiterService } from './recruiter.service.js';
import { RecruiterRepository } from './recruiter.repo.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class RecruiterController {
  private service: RecruiterService;

  constructor() {
    this.service = new RecruiterService(new RecruiterRepository());
  }

  search = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const results = await this.service.search(req.body, req.user!.id);
      res.json(results);
    } catch (error) {
      next(error);
    }
  };

  viewProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const profile = await this.service.viewProfile(req.params.profileId as string, req.user!.id);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  requestContact = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.requestContact(
        req.user!.id,
        req.params.profileId as string,
        req.body,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const history = await this.service.getSearchHistory(req.user!.id);
      res.json({ contactRequests: history });
    } catch (error) {
      next(error);
    }
  };
}
