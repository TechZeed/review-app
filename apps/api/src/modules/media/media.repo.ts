import { BaseRepo } from '../../shared/db/base.repo.js';
import { ReviewMedia } from './media.model.js';

export class MediaRepository extends BaseRepo<ReviewMedia> {
  constructor() {
    super(ReviewMedia);
  }

  async findByReviewId(reviewId: string): Promise<ReviewMedia | null> {
    return this.model.findOne({
      where: { reviewId },
    });
  }

  async findAllByReviewId(reviewId: string): Promise<ReviewMedia[]> {
    return this.model.findAll({
      where: { reviewId },
      order: [['createdAt', 'DESC']],
    });
  }

  async updateProcessingStatus(
    id: string,
    status: string,
    error?: string,
  ): Promise<void> {
    const updates: any = { processingStatus: status };
    if (error) {
      updates.processingError = error;
    }
    await this.model.update(updates, { where: { id } });
  }
}
