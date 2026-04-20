import express, { Router } from 'express';
import { SubscriptionController } from './subscription.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../middleware/validate.js';
import { createCheckoutSchema, cancelSchema, createPortalSchema } from './subscription.validation.js';

export const subscriptionRouter = Router();
const controller = new SubscriptionController();

// POST /webhook — Stripe webhook (public, raw body for signature verification)
// Must be registered BEFORE any JSON body parser on this router
subscriptionRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  controller.handleWebhook,
);

// All remaining routes require authentication
subscriptionRouter.use(authenticate);

// POST /checkout — create a Stripe checkout session
subscriptionRouter.post(
  '/checkout',
  validateBody(createCheckoutSchema),
  controller.checkout,
);

// POST /portal — create a Stripe billing portal session
subscriptionRouter.post(
  '/portal',
  validateBody(createPortalSchema),
  controller.portal,
);

// GET /me — get current subscription
subscriptionRouter.get(
  '/me',
  controller.getMe,
);

// POST /cancel — cancel subscription
subscriptionRouter.post(
  '/cancel',
  validateBody(cancelSchema),
  controller.cancel,
);
