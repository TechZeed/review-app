import { Response, NextFunction } from "express";
import { AuthRequest } from "./authenticate.js";
import { AppError } from "../shared/errors/appError.js";
import { APP_USER_ROLES, type AppUserRole } from "./roles.js";

function isValidRole(role: string): role is AppUserRole {
  return (APP_USER_ROLES as readonly string[]).includes(role);
}

/**
 * Authorization middleware factory
 * Checks if user has required role
 */
export function requireRole(allowedRoles: ReadonlyArray<AppUserRole>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("Authentication required", 401, "UNAUTHORIZED"),
      );
    }

    if (!isValidRole(req.user.role)) {
      return next(
        new AppError("Invalid user role in token", 401, "INVALID_TOKEN_ROLE"),
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("Insufficient permissions", 403, "FORBIDDEN"),
      );
    }

    next();
  };
}
