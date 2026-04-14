import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error("request failed", {
    traceId: (req as any).traceId,
    err: { message: err?.message, stack: err?.stack },
  });

  const response: any = {
    error: err?.message ?? "Internal Server Error",
    traceId: (req as any).traceId,
  };

  // Add error code if present
  if (err?.code) {
    response.code = err.code;
  }

  // Add additional details if present
  if (err?.details) {
    response.details = err.details;
  }

  res.status(err?.statusCode ?? 500).json(response);
}
