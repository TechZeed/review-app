import { Op } from 'sequelize';
import { BaseRepo } from '../../shared/db/base.repo.js';

// Model type placeholder — will be the Sequelize ReviewToken model
type ReviewToken = any;

export class VerificationRepository extends BaseRepo<ReviewToken> {
  constructor(model: any) {
    super(model);
  }

  async findByTokenHash(tokenHash: string): Promise<ReviewToken | null> {
    return this.model.findOne({
      where: { tokenHash },
    });
  }

  async findValidToken(tokenId: string): Promise<ReviewToken | null> {
    return this.model.findOne({
      where: {
        id: tokenId,
        expiresAt: { [Op.gt]: new Date() },
        isUsed: false,
      },
    });
  }

  async countRecentByDevice(
    deviceFingerprintHash: string,
    windowHours: number = 1,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return this.model.count({
      where: {
        deviceFingerprintHash,
        createdAt: { [Op.gte]: windowStart },
        isUsed: true,
      },
    });
  }

  // Phone-level cooldown lives in the `reviews` table (reviewer_phone_hash +
  // created_at). This repo only tracks token lifecycle.
  async countRecentByPhone(): Promise<number> {
    return 0;
  }

  async countDistinctDeviceReviews(
    deviceFingerprintHash: string,
    windowHours: number = 1,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const result = await this.model.count({
      where: {
        deviceFingerprintHash,
        createdAt: { [Op.gte]: windowStart },
        isUsed: true,
      },
      distinct: true,
      col: 'profileId',
    });
    return result;
  }

  // Phone-per-device counting requires joining to the reviews table; not
  // supported here. Tests exercise the rate-limit via the reviews table.
  async countDistinctPhonesPerDevice(): Promise<number> {
    return 0;
  }
}
