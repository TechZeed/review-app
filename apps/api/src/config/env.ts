import { z } from "zod";

const EnvSchema = z.object({
  // ---- Server ----
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // ---- Database ----
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default("review_app"),
  POSTGRES_USER: z.string().default("review_user"),
  POSTGRES_PASSWORD: z.string().default("changeme"),

  // ---- Auth ----
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRATION_TIME_IN_MINUTES: z.coerce.number().default(60),

  // ---- Firebase ----
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // ---- Storage (GCP Cloud Storage) ----
  GCP_BUCKET_NAME: z.string().min(1, "GCP_BUCKET_NAME is required"),
  GCP_PROJECT_ID: z.string().optional(),

  // ---- Payments (Stripe) ----
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_EMPLOYER_PRICE_ID: z.string().optional(),
  STRIPE_RECRUITER_BASIC_PRICE_ID: z.string().optional(),
  STRIPE_RECRUITER_PREMIUM_PRICE_ID: z.string().optional(),

  // ---- OTP (Twilio) ----
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // ---- CDN / Media ----
  CDN_BASE_URL: z.string().url().optional(),
  MAX_VIDEO_SIZE_MB: z.coerce.number().default(50),
  MAX_VOICE_SIZE_MB: z.coerce.number().default(5),

  // ---- QR Code ----
  QR_TOKEN_ROTATION_SECONDS: z.coerce.number().default(60),
  REVIEW_SESSION_TTL_HOURS: z.coerce.number().default(48),

  // ---- Rate Limiting ----
  RATE_LIMIT_TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),

  // ---- Observability ----
  OTEL_SERVICE_NAME: z.string().default("review-app-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  // ---- Logging ----
  ENABLE_HTTP_LOGGING: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // ---- App URLs ----
  APP_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

export const env = EnvSchema.parse(process.env);
