import { Response, NextFunction } from "express";
import { AuthRequest } from "./authenticate.js";

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failure";
  metadata?: Record<string, unknown>;
}

/**
 * Audit log middleware
 * Logs successful actions to audit_logs table
 */
export function auditLog(action: string, entityType?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Log after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            // Import dynamically to avoid circular dependencies
            const { AuditLogService } = await import(
              "../modules/audit/audit.service.js"
            );

            await AuditLogService.log({
              userId: req.user?.id,
              action,
              entityType: entityType || req.params.entityType,
              entityId: req.params.id || body?.id,
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"],
              status: "success",
            });
          } catch (error) {
            // Log audit failure but don't block response
            console.error("Audit log failed:", error);
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
}
