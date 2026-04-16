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
   * POST /api/v1/auth/login (legacy Firebase-based login)
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
   * Exchange Firebase token for app JWT (auto-create on first login)
   * POST /api/v1/auth/exchange-token
   */
  exchangeToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.exchangeFirebaseToken(req.body.firebaseToken);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login with email/password (internal accounts)
   * POST /api/v1/auth/login (password-based)
   */
  passwordLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.loginWithPassword(req.body);
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

  /**
   * Request a role upgrade
   * POST /api/v1/auth/role-request
   */
  requestRoleUpgrade = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const roleRequest = await this.authService.requestRoleUpgrade(req.user!.id, req.body);
      res.status(201).json({ roleRequest });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get my pending role request
   * GET /api/v1/auth/role-request/me
   */
  getMyRoleRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const roleRequest = await this.authService.getMyRoleRequest(req.user!.id);
      res.json({ roleRequest: roleRequest ?? null });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create an email/password user (admin only)
   * POST /api/v1/auth/admin/create-user
   */
  createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.createUserByAdmin(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * List pending role requests (admin only)
   * GET /api/v1/auth/admin/role-requests
   */
  listRoleRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const roleRequests = await this.authService.listRoleRequests();
      res.json({ roleRequests });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Approve a role request (admin only)
   * POST /api/v1/auth/admin/role-requests/:id/approve
   */
  approveRoleRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const roleRequest = await this.authService.approveRoleRequest(req.params.id as string, req.user!.id);
      res.json({ roleRequest });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reject a role request (admin only)
   * POST /api/v1/auth/admin/role-requests/:id/reject
   */
  rejectRoleRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const roleRequest = await this.authService.rejectRoleRequest(req.params.id as string, req.user!.id);
      res.json({ roleRequest });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List all users (admin only)
   * GET /api/v1/auth/admin/users
   */
  listUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await this.authService.listUsers();
      res.json({ users });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a user's role (admin only)
   * PATCH /api/v1/auth/admin/users/:id/role
   */
  updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.updateUserRole(req.params.id as string, req.body.role);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a user's status (admin only)
   * PATCH /api/v1/auth/admin/users/:id/status
   */
  updateUserStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.updateUserStatus(req.params.id as string, req.body.status);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  };
}
