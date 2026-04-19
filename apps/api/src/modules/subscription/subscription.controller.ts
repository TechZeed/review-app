import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from './subscription.service.js';
import { SubscriptionRepository } from './subscription.repo.js';
import { verifyWebhookSignature } from './stripe.webhook.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class SubscriptionController {
  private service: SubscriptionService;

  constructor() {
    this.service = new SubscriptionService(new SubscriptionRepository());
  }

  checkout = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createCheckoutSession(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const subscription = await this.service.getMySubscription(req.user!.id);
      if (!subscription) {
        const capabilities = await this.service.listActiveCapabilities(req.user!.id);
        res.json({ tier: 'free', status: 'none', capabilities });
        return;
      }
      res.json(subscription);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const immediate = req.body?.immediate ?? false;
      const result = await this.service.cancelSubscription(req.user!.id, immediate);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = verifyWebhookSignature(req);
      await this.service.handleWebhookEvent(event);
      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  };
}
