import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { AppError } from "../shared/errors/appError.js";

/**
 * Validate request body against Zod schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e: any) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        next(
          new AppError(
            `Validation failed: ${JSON.stringify(errors)}`,
            400,
            "VALIDATION_ERROR",
          ),
        );
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query) as any;
      Object.keys(req.query).forEach((key) => delete (req.query as any)[key]);
      Object.assign(req.query, parsed);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e: any) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        next(
          new AppError(
            `Invalid query parameters: ${JSON.stringify(errors)}`,
            400,
            "VALIDATION_ERROR",
          ),
        );
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate route parameters against Zod schema
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e: any) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        next(
          new AppError(
            `Invalid parameters: ${JSON.stringify(errors)}`,
            400,
            "VALIDATION_ERROR",
          ),
        );
      } else {
        next(error);
      }
    }
  };
}

/**
 * Generic validator that handles body, params, and query validation
 */
export function validate(schema: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params)
        req.params = schema.params.parse(req.params) as any;
      if (schema.query) {
        const parsed = schema.query.parse(req.query) as any;
        Object.keys(req.query).forEach(
          (key) => delete (req.query as any)[key],
        );
        Object.assign(req.query, parsed);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e: any) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        next(
          new AppError(
            `Validation failed: ${JSON.stringify(errors)}`,
            400,
            "VALIDATION_ERROR",
          ),
        );
      } else {
        next(error);
      }
    }
  };
}
