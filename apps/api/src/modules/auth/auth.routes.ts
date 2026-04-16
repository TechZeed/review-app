import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { ADMIN_ROLES } from '../../middleware/roles.js';
import { authRateLimit } from '../../middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  exchangeFirebaseTokenSchema,
  passwordLoginSchema,
  createUserSchema,
  roleRequestSchema,
  updateRoleSchema,
  updateStatusSchema,
  roleRequestIdParamSchema,
  userIdParamSchema,
} from './auth.validation.js';

export const authRouter = Router();
const controller = new AuthController();

// ──── Public routes (with rate limiting) ────

authRouter.post(
  '/register',
  authRateLimit,
  validateBody(registerSchema),
  controller.register
);

authRouter.post(
  '/exchange-token',
  authRateLimit,
  validateBody(exchangeFirebaseTokenSchema),
  controller.exchangeToken
);

authRouter.post(
  '/login',
  authRateLimit,
  validateBody(passwordLoginSchema),
  controller.passwordLogin
);

// ──── Authenticated routes (any role) ────

authRouter.get(
  '/me',
  authenticate,
  controller.me
);

authRouter.post(
  '/logout',
  authenticate,
  controller.logout
);

authRouter.post(
  '/role-request',
  authenticate,
  validateBody(roleRequestSchema),
  controller.requestRoleUpgrade
);

authRouter.get(
  '/role-request/me',
  authenticate,
  controller.getMyRoleRequest
);

// ──── Admin routes ────

authRouter.post(
  '/admin/create-user',
  authenticate,
  requireRole(ADMIN_ROLES),
  validateBody(createUserSchema),
  controller.createUser
);

authRouter.get(
  '/admin/role-requests',
  authenticate,
  requireRole(ADMIN_ROLES),
  controller.listRoleRequests
);

authRouter.post(
  '/admin/role-requests/:id/approve',
  authenticate,
  requireRole(ADMIN_ROLES),
  validateParams(roleRequestIdParamSchema),
  controller.approveRoleRequest
);

authRouter.post(
  '/admin/role-requests/:id/reject',
  authenticate,
  requireRole(ADMIN_ROLES),
  validateParams(roleRequestIdParamSchema),
  controller.rejectRoleRequest
);

authRouter.get(
  '/admin/users',
  authenticate,
  requireRole(ADMIN_ROLES),
  controller.listUsers
);

authRouter.patch(
  '/admin/users/:id/role',
  authenticate,
  requireRole(ADMIN_ROLES),
  validateParams(userIdParamSchema),
  validateBody(updateRoleSchema),
  controller.updateUserRole
);

authRouter.patch(
  '/admin/users/:id/status',
  authenticate,
  requireRole(ADMIN_ROLES),
  validateParams(userIdParamSchema),
  validateBody(updateStatusSchema),
  controller.updateUserStatus
);
