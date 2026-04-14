import { Request } from 'express';
import Stripe from 'stripe';
import { getStripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/appError.js';

/**
 * Verify Stripe webhook signature and return the parsed event.
 *
 * The request body must be the raw Buffer (not parsed JSON).
 * Express must be configured to pass raw body for this route:
 *   express.raw({ type: 'application/json' })
 */
export function verifyWebhookSignature(req: Request): Stripe.Event {
  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    throw new AppError('Missing stripe-signature header', 400, 'INVALID_WEBHOOK_SIGNATURE');
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError('Webhook secret not configured', 500, 'WEBHOOK_CONFIG_ERROR');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      webhookSecret,
    );
    return event;
  } catch (err: any) {
    throw new AppError(
      `Webhook signature verification failed: ${err.message}`,
      400,
      'INVALID_WEBHOOK_SIGNATURE',
    );
  }
}
