import { Request, Response, NextFunction } from 'express';
import { EmployerService } from './employer.service.js';
import { EmployerRepository } from './employer.repo.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class EmployerController {
  private service: EmployerService;

  constructor() {
    this.service = new EmployerService(new EmployerRepository());
  }

  getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dashboard = await this.service.getDashboard(req.user!.id);
      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  };

  getTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getTeamMembers(req.user!.id, req.query as any);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const member = await this.service.getTeamMember(req.user!.id, req.params.profileId);
      res.json(member);
    } catch (error) {
      next(error);
    }
  };

  getTopPerformers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const performers = await this.service.getTopPerformers(req.user!.id);
      res.json({ topPerformers: performers });
    } catch (error) {
      next(error);
    }
  };

  getRetentionSignals = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const signals = await this.service.getRetentionSignals(req.user!.id);
      res.json({ retentionSignals: signals });
    } catch (error) {
      next(error);
    }
  };
}
