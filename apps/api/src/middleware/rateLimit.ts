import rateLimit from "express-rate-limit";

// In test runs, rate limits otherwise trip inside a single vitest process as
// many scenarios hit the same endpoints. Skip the limiter under NODE_ENV=test;
// the behaviour itself still has dedicated coverage if you mock the window.
const skipInTest = () => process.env.NODE_ENV === "test";

/**
 * Authentication endpoints (login, register)
 * 5 requests per 15 minutes
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: skipInTest,
});

/**
 * General API endpoints
 * 200 requests per 15 minutes
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: skipInTest,
});

/**
 * Review submission endpoints
 * 10 requests per 1 hour per device (keyed by IP + device fingerprint header)
 */
export const reviewRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Review rate limit exceeded. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: skipInTest,
  keyGenerator: (req) => {
    const deviceFingerprint = req.headers["x-device-fingerprint"] || "";
    return `${req.ip}:${deviceFingerprint}`;
  },
});

/**
 * OTP request endpoints
 * 3 requests per 15 minutes
 */
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message:
    "Too many OTP requests. Please wait before requesting another code.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: skipInTest,
});

/**
 * Media upload endpoints (voice/video)
 * 5 uploads per 1 hour
 */
export const mediaUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Upload rate limit exceeded. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: skipInTest,
});

/**
 * Recruiter search endpoints
 * 50 requests per 15 minutes
 */
export const recruiterSearchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Search rate limit exceeded. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: skipInTest,
});
