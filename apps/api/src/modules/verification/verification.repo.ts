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
        status: { [Op.ne]: 'used' },
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
        status: 'used',
      },
    });
  }

  async countRecentByPhone(
    phoneHash: string,
    profileId: string,
    windowDays: number = 7,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    return this.model.count({
      where: {
        phoneHash,
        profileId,
        usedAt: { [Op.gte]: windowStart },
        status: 'used',
      },
    });
  }

  async countDistinctDeviceReviews(
    deviceFingerprintHash: string,
    windowHours: number = 1,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const result = await this.model.count({
      where: {
        deviceFingerprintHash,
        usedAt: { [Op.gte]: windowStart },
        status: 'used',
      },
      distinct: true,
      col: 'profileId',
    });
    return result;
  }

  async countDistinctPhonesPerDevice(
    deviceFingerprintHash: string,
    windowDays: number = 30,
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const result = await this.model.count({
      where: {
        deviceFingerprintHash,
        phoneHash: { [Op.ne]: null },
        createdAt: { [Op.gte]: windowStart },
      },
      distinct: true,
      col: 'phoneHash',
    });
    return result;
  }
}
