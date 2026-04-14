import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

/**
 * Attach request ID, timestamp, and IP to request object for tracing
 */
export function requestContext(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const requestId =
    (req.headers["x-request-id"] as string) || randomUUID();

  (req as any).traceId = requestId;
  (req as any).requestTimestamp = Date.now();

  next();
}
