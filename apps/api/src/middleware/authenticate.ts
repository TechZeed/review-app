import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../shared/errors/appError.js";
import { env } from "../config/env.js";
import { APP_USER_ROLES, type AppUserRole } from "./roles.js";

export interface AuthUser {
  id: string;
  email: string;
  role: AppUserRole;
  isApproved: boolean;
  status: string;
  tier?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

function getBearerToken(authHeader?: string): string {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("No token provided", 401, "UNAUTHORIZED");
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError("No token provided", 401, "UNAUTHORIZED");
  }

  return token;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function parseTokenPayload(payload: jwt.JwtPayload | string): {
  sub: string;
  email: string;
  role: string;
  isApproved: boolean;
  status: string;
  tier?: string;
} {
  if (!payload || typeof payload === "string") {
    throw new AppError("Invalid token payload", 401, "INVALID_TOKEN");
  }

  const { sub, email, role, status, tier } = payload;

  if (
    typeof sub !== "string" ||
    typeof email !== "string" ||
    typeof role !== "string"
  ) {
    throw new AppError("Invalid token payload", 401, "INVALID_TOKEN");
  }

  if (!(APP_USER_ROLES as readonly string[]).includes(role)) {
    throw new AppError("Invalid token role", 401, "INVALID_TOKEN_ROLE");
  }

  return {
    sub,
    email,
    role,
    isApproved: toBoolean(payload.isApproved),
    status: typeof status === "string" ? status : "active",
    tier: typeof tier === "string" ? tier : undefined,
  };
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = getBearerToken(req.headers.authorization);
    const secret = env.JWT_SECRET;

    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const parsed = parseTokenPayload(payload);

    req.user = {
      id: parsed.sub,
      email: parsed.email,
      role: parsed.role as AppUserRole,
      isApproved: parsed.isApproved,
      status: parsed.status,
      tier: parsed.tier,
    };

    // Check account status
    if (req.user.status !== "active") {
      throw new AppError("Account is not active", 403, "ACCOUNT_NOT_ACTIVE");
    }

    // Check approval -- INDIVIDUAL role is auto-approved on signup
    if (!req.user.isApproved && req.user.role !== "INDIVIDUAL") {
      throw new AppError(
        "Account pending approval",
        403,
        "ACCOUNT_PENDING_APPROVAL",
      );
    }

    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError("Invalid token", 401, "INVALID_TOKEN"));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError("Token expired", 401, "TOKEN_EXPIRED"));
    }
    next(error);
  }
}
