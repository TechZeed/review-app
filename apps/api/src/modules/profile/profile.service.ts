import { nanoid } from 'nanoid';
import { ProfileRepo } from './profile.repo.js';
import { QrService } from './qr.service.js';
import { AppError } from '../../shared/errors/appError.js';
import { env } from '../../config/env.js';
import type { CreateProfileInput, UpdateProfileInput } from './profile.types.js';

export class ProfileService {
  private qrService: QrService;

  constructor(private repo: ProfileRepo) {
    this.qrService = new QrService();
  }

  /**
   * Create a new profile for the authenticated user.
   * Auto-generates a slug via nanoid and generates a QR code.
   */
  async createProfile(userId: string, data: CreateProfileInput): Promise<any> {
    // Check if user already has a profile
    const existing = await this.repo.findByUserId(userId);
    if (existing) {
      throw new AppError('Profile already exists', 409, 'PROFILE_ALREADY_EXISTS');
    }

    // Generate a unique slug
    const slug = nanoid(10).toLowerCase();

    // Generate and upload QR code
    const qrCodeUrl = await this.qrService.generateAndUploadQr(slug);

    const profile = await this.repo.create({
      userId,
      slug,
      headline: data.name,
      industry: data.industry ?? null,
      bio: data.bio ?? null,
      qrCodeUrl,
      visibility: data.visibility ?? 'private',
      totalReviews: 0,
      expertiseCount: 0,
      careCount: 0,
      deliveryCount: 0,
      initiativeCount: 0,
      trustCount: 0,
    } as any);

    return this.toResponse(profile);
  }

  /**
   * Update the authenticated user's profile
   */
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<any> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    const updates: any = {};
    if (data.name !== undefined) updates.headline = data.name;
    if (data.industry !== undefined) updates.industry = data.industry;
    if (data.bio !== undefined) updates.bio = data.bio;

    await this.repo.updateById(profile.getDataValue('id'), updates);
    const updated = await this.repo.findById(profile.getDataValue('id'));

    return this.toResponse(updated!);
  }

  /**
   * Get a profile by slug (public)
   */
  async getBySlug(slug: string): Promise<any> {
    const profile = await this.repo.findBySlug(slug);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    // Check visibility for public access
    const visibility = profile.getDataValue('visibility');
    if (visibility === 'private') {
      throw new AppError('This profile is private', 403, 'PROFILE_PRIVATE');
    }

    return this.toPublicResponse(profile);
  }

  /**
   * Get the authenticated user's own profile
   */
  async getMyProfile(userId: string): Promise<any> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    return this.toResponse(profile);
  }

  /**
   * Update profile visibility
   */
  async updateVisibility(userId: string, visibility: string): Promise<any> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    await this.repo.updateById(profile.getDataValue('id'), { visibility });
    return {
      visibility,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get quality stats for the authenticated user's profile
   */
  async getQualityStats(userId: string): Promise<any> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    const totalReviews = profile.getDataValue('totalReviews') ?? 0;
    const expertiseCount = profile.getDataValue('expertiseCount') ?? 0;
    const careCount = profile.getDataValue('careCount') ?? 0;
    const deliveryCount = profile.getDataValue('deliveryCount') ?? 0;
    const initiativeCount = profile.getDataValue('initiativeCount') ?? 0;
    const trustCount = profile.getDataValue('trustCount') ?? 0;

    const totalPicks = expertiseCount + careCount + deliveryCount + initiativeCount + trustCount;

    const pct = (count: number) => (totalPicks > 0 ? Math.round((count / totalPicks) * 100) : 0);

    const qualityBreakdown = {
      expertise: { count: expertiseCount, percentage: pct(expertiseCount) },
      care: { count: careCount, percentage: pct(careCount) },
      delivery: { count: deliveryCount, percentage: pct(deliveryCount) },
      initiative: { count: initiativeCount, percentage: pct(initiativeCount) },
      trust: { count: trustCount, percentage: pct(trustCount) },
    };

    // Signature strengths: qualities above 25% threshold
    const signatureStrengths = Object.entries(qualityBreakdown)
      .filter(([_, v]) => v.percentage >= 25)
      .sort((a, b) => b[1].percentage - a[1].percentage)
      .map(([name]) => name);

    // Trust tier based on total reviews
    let trustTier = 'new';
    if (totalReviews >= 50) trustTier = 'veteran';
    else if (totalReviews >= 25) trustTier = 'mature';
    else if (totalReviews >= 10) trustTier = 'established';
    else if (totalReviews >= 3) trustTier = 'emerging';

    return {
      totalReviews,
      totalQualityPicks: totalPicks,
      qualityBreakdown,
      signatureStrengths,
      trustTier,
    };
  }

  private toResponse(profile: any) {
    const displayName = profile.user?.displayName ?? profile.user?.getDataValue?.("displayName");
    const totalReviews = profile.totalReviews ?? 0;
    const expertiseCount = profile.expertiseCount ?? 0;
    const careCount = profile.careCount ?? 0;
    const deliveryCount = profile.deliveryCount ?? 0;
    const initiativeCount = profile.initiativeCount ?? 0;
    const trustCount = profile.trustCount ?? 0;
    const totalPicks = expertiseCount + careCount + deliveryCount + initiativeCount + trustCount;
    const pct = (c: number) => (totalPicks > 0 ? Math.round((c / totalPicks) * 100) : 0);

    return {
      id: profile.id,
      slug: profile.slug,
      // spec 19 B2: `name` is the person's display name; role title lives in `headline`.
      name: displayName ?? profile.headline,
      headline: profile.headline,
      industry: profile.industry,
      bio: profile.bio,
      visibility: profile.visibility,
      qrCodeUrl: profile.qrCodeUrl,
      profileUrl: `${env.FRONTEND_URL}/r/${profile.slug}`,
      reviewCount: totalReviews,
      // spec 19 B4: include qualityBreakdown on /profiles/me so Home can
      // render without a second fetch.
      qualityBreakdown: {
        expertise: pct(expertiseCount),
        care: pct(careCount),
        delivery: pct(deliveryCount),
        initiative: pct(initiativeCount),
        trust: pct(trustCount),
      },
      createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : undefined,
      updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : undefined,
    };
  }

  private toPublicResponse(profile: any) {
    const displayName = profile.user?.displayName ?? profile.user?.getDataValue?.("displayName");
    const totalReviews = profile.totalReviews ?? 0;
    const expertiseCount = profile.expertiseCount ?? 0;
    const careCount = profile.careCount ?? 0;
    const deliveryCount = profile.deliveryCount ?? 0;
    const initiativeCount = profile.initiativeCount ?? 0;
    const trustCount = profile.trustCount ?? 0;
    const totalPicks = expertiseCount + careCount + deliveryCount + initiativeCount + trustCount;
    const pct = (c: number) => (totalPicks > 0 ? Math.round((c / totalPicks) * 100) : 0);

    return {
      id: profile.id,
      slug: profile.slug,
      // spec 19 B2: `name` is the person's display name; role title in `headline`.
      name: displayName ?? profile.headline,
      headline: profile.headline,
      industry: profile.industry,
      bio: profile.bio,
      qualityBreakdown: {
        expertise: pct(expertiseCount),
        care: pct(careCount),
        delivery: pct(deliveryCount),
        initiative: pct(initiativeCount),
        trust: pct(trustCount),
      },
      reviewCount: totalReviews,
      profileUrl: `${env.FRONTEND_URL}/r/${profile.slug}`,
    };
  }
}
