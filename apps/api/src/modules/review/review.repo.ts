import { Op } from 'sequelize';
import { BaseRepo } from '../../shared/db/base.repo.js';
import { Review } from './review.model.js';

export class ReviewRepo extends BaseRepo<Review> {
  constructor() {
    super(Review);
  }

  /**
   * Find reviews by profile with pagination
   */
  async findByProfile(
    profileId: string,
    options: { page: number; limit: number; sortBy?: string },
  ): Promise<{ rows: Review[]; count: number }> {
    const offset = (options.page - 1) * options.limit;

    const order: any[] =
      options.sortBy === 'badgeTier'
        ? [['badgeType', 'DESC'], ['createdAt', 'DESC']]
        : [['createdAt', 'DESC']];

    return this.model.findAndCountAll({
      where: { profileId },
      order,
      limit: options.limit,
      offset,
    });
  }

  /**
   * Count total reviews for a profile
   */
  async countByProfile(profileId: string): Promise<number> {
    return this.model.count({
      where: { profileId },
    });
  }

  /**
   * Customer-side history: all reviews created from a given device
   * fingerprint hash, newest first. Used by GET /reviews/my-submissions
   * (spec 19 — customer-side review history).
   */
  async findByDeviceFingerprintHash(
    deviceFingerprintHash: string,
    options: { page: number; limit: number },
  ): Promise<{ rows: Review[]; count: number }> {
    const offset = (options.page - 1) * options.limit;
    return this.model.findAndCountAll({
      where: { deviceFingerprintHash },
      order: [['createdAt', 'DESC']],
      limit: options.limit,
      offset,
    });
  }

  /**
   * Find a review by reviewer phone hash and profile within a time window
   */
  async findByReviewerAndProfile(
    phoneHash: string,
    profileId: string,
    withinDays: number = 7,
  ): Promise<Review | null> {
    const since = new Date();
    since.setDate(since.getDate() - withinDays);

    return this.model.findOne({
      where: {
        profileId,
        reviewerPhoneHash: phoneHash,
        createdAt: { [Op.gte]: since },
      },
    });
  }
}
