import { QualityRepo } from './quality.repo.js';
import { ProfileRepo } from '../profile/profile.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import type { QualityResponse, QualityScoreResponse, QualityName } from './quality.types.js';

/**
 * Hardcoded quality definitions — used as fallback if the DB table is not seeded yet.
 */
const DEFAULT_QUALITIES: QualityResponse[] = [
  {
    id: '1',
    name: 'expertise' as QualityName,
    label: 'Expertise',
    description: 'Demonstrates deep knowledge and skill in their domain',
    customerLanguage: 'Expert in their domain',
    sortOrder: 1,
  },
  {
    id: '2',
    name: 'care' as QualityName,
    label: 'Care',
    description: 'Shows genuine concern and makes people feel valued',
    customerLanguage: 'Made me feel valued',
    sortOrder: 2,
  },
  {
    id: '3',
    name: 'delivery' as QualityName,
    label: 'Delivery',
    description: 'Delivers on promises consistently and reliably',
    customerLanguage: 'Did exactly what they promised',
    sortOrder: 3,
  },
  {
    id: '4',
    name: 'initiative' as QualityName,
    label: 'Initiative',
    description: 'Goes above and beyond expectations proactively',
    customerLanguage: 'Went beyond what I asked',
    sortOrder: 4,
  },
  {
    id: '5',
    name: 'trust' as QualityName,
    label: 'Trust',
    description: 'Earns trust through consistency and integrity',
    customerLanguage: "I'd come back to this person",
    sortOrder: 5,
  },
];

export class QualityService {
  constructor(
    private repo: QualityRepo,
    private profileRepo: ProfileRepo,
  ) {}

  /**
   * List all qualities (from DB, with fallback to hardcoded defaults)
   */
  async listQualities(): Promise<QualityResponse[]> {
    try {
      const qualities = await this.repo.findAllOrdered();
      if (qualities.length > 0) {
        return qualities.map((q) => ({
          id: q.getDataValue('id'),
          name: q.getDataValue('name') as QualityName,
          label: q.getDataValue('label'),
          description: q.getDataValue('description'),
          customerLanguage: q.getDataValue('customerLanguage'),
          sortOrder: q.getDataValue('sortOrder'),
        }));
      }
    } catch {
      // DB may not be available yet
    }

    return DEFAULT_QUALITIES;
  }

  /**
   * Get quality scores for a given profile.
   * Calculates percentages from the profile's quality counters.
   */
  async getScoresByProfile(profileId: string): Promise<QualityScoreResponse[]> {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    const expertiseCount = profile.getDataValue('expertiseCount') ?? 0;
    const careCount = profile.getDataValue('careCount') ?? 0;
    const deliveryCount = profile.getDataValue('deliveryCount') ?? 0;
    const initiativeCount = profile.getDataValue('initiativeCount') ?? 0;
    const trustCount = profile.getDataValue('trustCount') ?? 0;

    const totalPicks = expertiseCount + careCount + deliveryCount + initiativeCount + trustCount;
    const pct = (count: number) => (totalPicks > 0 ? Math.round((count / totalPicks) * 100) : 0);

    // Get quality IDs from DB if available
    const qualities = await this.listQualities();
    const qualityMap = new Map(qualities.map((q) => [q.name, q]));

    const counters: Record<string, number> = {
      expertise: expertiseCount,
      care: careCount,
      delivery: deliveryCount,
      initiative: initiativeCount,
      trust: trustCount,
    };

    return qualities.map((q) => ({
      qualityId: q.id,
      qualityName: q.name,
      label: q.label,
      pickCount: counters[q.name] ?? 0,
      percentage: pct(counters[q.name] ?? 0),
    }));
  }
}
