import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';
import { capabilityRepo, CapabilityName } from '../modules/capability/capability.repo.js';
import { logger } from '../config/logger.js';

// Legacy role → capability fallback map for the dual-read phase (spec 28 §12).
// Once soak is clean, this entire fallback branch is deleted per step 6.
const LEGACY_ROLE_CAPABILITY: Record<string, string[]> = {
  EMPLOYER: ['employer'],
  RECRUITER: ['recruiter'],
};

export function requireCapability(cap: CapabilityName) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // ADMIN role is an unconditional bypass (spec 28 §14).
    if (user.role === 'ADMIN') return next();

    try {
      const active = await capabilityRepo.isActive(user.id, cap);
      if (active) return next();

      // Legacy-role fallback — spec 28 §12 step 3. Remove in follow-up spec
      // once the soak shows no traffic on this path.
      const legacyCaps = LEGACY_ROLE_CAPABILITY[user.role] ?? [];
      if (legacyCaps.includes(cap)) {
        logger.warn('requireCapability: legacy-role fallback used', {
          userId: user.id,
          role: user.role,
          requiredCapability: cap,
          deprecation: 'spec-28-legacy-role-fallback',
        });
        return next();
      }

      return res.status(403).json({
        error: `This feature requires the ${cap} subscription`,
        code: 'CAPABILITY_REQUIRED',
        requiredCapability: cap,
      });
    } catch (err) {
      return next(err);
    }
  };
}
