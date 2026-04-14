import { Request, Response, NextFunction } from 'express';
import { ReferenceService } from './reference.service.js';
import { ReferenceRepository } from './reference.repo.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class ReferenceController {
  private service: ReferenceService;

  constructor() {
    this.service = new ReferenceService(new ReferenceRepository());
  }

  optIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.optIn(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.withdraw(req.params.referenceId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  requestContact = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.requestContact(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getByProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getByProfile(req.params.profileId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
