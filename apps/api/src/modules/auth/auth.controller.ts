import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate.js';
import { AuthService } from './auth.service.js';
import { AuthRepo } from './auth.repo.js';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService(new AuthRepo());
  }

  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.registerUser(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login user (exchange Firebase token for app JWT)
   * POST /api/v1/auth/login
   */
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.loginUser(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout (client-side token deletion)
   * POST /api/v1/auth/logout
   */
  logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current authenticated user
   * GET /api/v1/auth/me
   */
  me = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.getUserById(req.user!.id);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  };
}
