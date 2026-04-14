import { BaseRepo } from '../../shared/db/base.repo.js';
import { Quality } from './quality.model.js';

export class QualityRepo extends BaseRepo<Quality> {
  constructor() {
    super(Quality);
  }

  /**
   * Find all qualities ordered by sortOrder
   */
  async findAllOrdered(): Promise<Quality[]> {
    return this.model.findAll({
      order: [['sortOrder', 'ASC']],
    });
  }

  /**
   * Find a quality by name
   */
  async findByName(name: string): Promise<Quality | null> {
    return this.model.findOne({
      where: { name },
    });
  }
}
