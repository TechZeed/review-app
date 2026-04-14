import { Router } from 'express';
import { VerificationController } from './verification.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  initiateSchema,
  sendOtpSchema,
  verifyOtpSchema,
  tokenIdParamSchema,
} from './verification.validation.js';

export const verificationRouter = Router();
const controller = new VerificationController();

// POST /initiate — Scan QR code, create review token (public)
verificationRouter.post(
  '/initiate',
  validateBody(initiateSchema),
  controller.initiate,
);

// POST /otp/send — Send OTP to reviewer's phone (public)
verificationRouter.post(
  '/otp/send',
  validateBody(sendOtpSchema),
  controller.sendOtp,
);

// POST /otp/verify — Verify OTP code (public)
verificationRouter.post(
  '/otp/verify',
  validateBody(verifyOtpSchema),
  controller.verifyOtp,
);

// GET /token/:tokenId — Validate a review token (public)
verificationRouter.get(
  '/token/:tokenId',
  validateParams(tokenIdParamSchema),
  controller.validateToken,
);
