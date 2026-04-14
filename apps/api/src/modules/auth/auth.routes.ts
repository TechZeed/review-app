import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authRateLimit } from '../../middleware/rateLimit.js';
import { registerSchema, loginSchema } from './auth.validation.js';

export const authRouter = Router();
const controller = new AuthController();

// Public routes (with rate limiting)
authRouter.post(
  '/register',
  authRateLimit,
  validateBody(registerSchema),
  controller.register
);

authRouter.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  controller.login
);

// Protected routes
authRouter.post(
  '/logout',
  authenticate,
  controller.logout
);

authRouter.get(
  '/me',
  authenticate,
  controller.me
);
