import { BaseRepo } from '../../shared/db/base.repo.js';
import { Profile, ProfileAttributes } from './profile.model.js';

export class ProfileRepo extends BaseRepo<Profile> {
  constructor() {
    super(Profile);
  }

  async findBySlug(slug: string): Promise<Profile | null> {
    return this.model.findOne({
      where: { slug },
    });
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.model.findOne({
      where: { userId },
    });
  }

  async updateQualityCounts(
    profileId: string,
    qualityPicks: string[],
  ): Promise<void> {
    const profile = await this.findById(profileId);
    if (!profile) return;

    const updates: any = {
      totalReviews: (profile.getDataValue('totalReviews') ?? 0) + 1,
    };

    for (const quality of qualityPicks) {
      const countField = `${quality}Count` as keyof ProfileAttributes;
      const currentVal = (profile.getDataValue(countField) as number) ?? 0;
      updates[countField] = currentVal + 1;
    }

    await this.model.update(updates, {
      where: { id: profileId },
    });
  }
}
