import express from "express";
import cors from "cors";
import { logger } from "./config/logger.js";
import { env } from "./config/env.js";
import { requestContext } from "./middleware/requestContext.js";
import { healthRouter } from "./health/health.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { authenticate } from "./middleware/authenticate.js";
import { requireRole } from "./middleware/authorize.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { profileRouter } from "./modules/profile/profile.routes.js";
import { reviewRouter } from "./modules/review/review.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { organizationRouter } from "./modules/organization/organization.routes.js";
import { qualityRouter } from "./modules/quality/quality.routes.js";
import { recruiterRouter } from "./modules/recruiter/recruiter.routes.js";
import { employerRouter } from "./modules/employer/employer.routes.js";
import { verificationRouter } from "./modules/verification/verification.routes.js";
import { referenceRouter } from "./modules/reference/reference.routes.js";
import { subscriptionRouter } from "./modules/subscription/subscription.routes.js";

export const app = express();

// Trust proxy - Trust only the first proxy (Cloud Run/GCP Load Balancer)
app.set("trust proxy", 1);

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Device-Fingerprint",
      "X-Review-Token",
      "X-Request-Id",
    ],
  }),
);

// Global middleware
app.use(express.json({ limit: "25mb" }));
app.use(apiRateLimit);
app.use(requestContext);

// Public routes
app.use("/health", healthRouter);

// API v1 routes
const v1Router = express.Router();

// Public routes
v1Router.use("/auth", authRouter);
v1Router.use("/profiles", profileRouter);
v1Router.use("/reviews", reviewRouter);
v1Router.use("/qualities", qualityRouter);
v1Router.use("/verification", verificationRouter);

// Protected routes
v1Router.use("/media", mediaRouter);
v1Router.use("/organizations", authenticate, organizationRouter);
v1Router.use("/recruiter", authenticate, requireRole(["RECRUITER", "ADMIN"]), recruiterRouter);
v1Router.use("/employer", authenticate, requireRole(["EMPLOYER", "ADMIN"]), employerRouter);
v1Router.use("/references", referenceRouter);
v1Router.use("/subscriptions", subscriptionRouter);

app.use("/api/v1", v1Router);

// Error handler (must be last)
app.use(errorHandler);
