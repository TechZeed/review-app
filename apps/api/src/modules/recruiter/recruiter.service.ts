import { RecruiterRepository } from './recruiter.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import type {
  SearchFilters,
  PaginatedSearchResult,
  ProfileViewResponse,
  ContactRequestInput,
  ContactRequestResponse,
} from './recruiter.types.js';

export class RecruiterService {
  constructor(private repo: RecruiterRepository) {}

  async search(
    filters: SearchFilters,
    recruiterUserId: string,
  ): Promise<PaginatedSearchResult> {
    return this.repo.search(filters, recruiterUserId);
  }

  async viewProfile(
    profileId: string,
    recruiterUserId: string,
  ): Promise<ProfileViewResponse> {
    const visibility = await this.repo.getProfileVisibility(profileId);
    if (!visibility) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    if (!['recruiter_visible', 'public'].includes(visibility)) {
      throw new AppError('Profile is not visible to recruiters', 403, 'PROFILE_NOT_VISIBLE');
    }

    const profile = await this.repo.findProfileForView(profileId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    // Log the profile view
    await this.repo.logProfileView(recruiterUserId, profileId);

    return {
      profileId: profile.profileId,
      slug: profile.slug,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      industry: profile.industry,
      location: profile.location,
      headline: profile.headline,
      totalReviews: Number(profile.totalReviews),
      qualityBreakdown: {
        expertise: Number(profile.expertiseCount),
        care: Number(profile.careCount),
        delivery: Number(profile.deliveryCount),
        initiative: Number(profile.initiativeCount),
        trust: Number(profile.trustCount),
      },
      hasVideo: Boolean(profile.hasVideo),
      verifiedRate: Number(profile.verifiedRate),
      verifiableReferenceCount: Number(profile.verifiableReferenceCount),
      isPro: Boolean(profile.isPro),
    };
  }

  async requestContact(
    recruiterUserId: string,
    profileId: string,
    data: ContactRequestInput,
  ): Promise<ContactRequestResponse> {
    // Check profile visibility
    const visibility = await this.repo.getProfileVisibility(profileId);
    if (!visibility || visibility === 'private') {
      throw new AppError('Profile not found or not visible', 404, 'PROFILE_NOT_VISIBLE');
    }

    // Check if recruiter is blocked
    const blocked = await this.repo.isRecruiterBlocked(profileId, recruiterUserId);
    if (blocked) {
      throw new AppError('You are blocked from contacting this profile', 403, 'RECRUITER_BLOCKED');
    }

    // Check rate limit: 20 requests per day
    const todayCount = await this.repo.countContactRequestsToday(recruiterUserId);
    if (todayCount >= 20) {
      throw new AppError(
        'Daily contact request limit exceeded (20/day)',
        429,
        'CONTACT_LIMIT_REACHED',
      );
    }

    // Check for duplicate pending request
    const hasPending = await this.repo.hasPendingContactRequest(recruiterUserId, profileId);
    if (hasPending) {
      throw new AppError(
        'A contact request is already pending for this profile',
        409,
        'CONTACT_REQUEST_ALREADY_PENDING',
      );
    }

    // Create the contact request
    const request = await this.repo.createContactRequest(recruiterUserId, profileId, data);

    return {
      id: request.id,
      recruiterUserId: request.recruiterUserId,
      profileId: request.profileId,
      subject: request.subject,
      message: request.message,
      hiringRole: request.hiringRole,
      companyName: request.companyName,
      status: request.status,
      respondedAt: request.respondedAt ? new Date(request.respondedAt).toISOString() : null,
      createdAt: new Date(request.createdAt).toISOString(),
    };
  }

  async getSearchHistory(recruiterUserId: string): Promise<ContactRequestResponse[]> {
    const requests = await this.repo.findContactRequests(recruiterUserId);
    return requests.map((r: any) => ({
      id: r.id,
      recruiterUserId: r.recruiterUserId,
      profileId: r.profileId,
      subject: r.subject,
      message: r.message,
      hiringRole: r.hiringRole,
      companyName: r.companyName,
      status: r.status,
      respondedAt: r.respondedAt ? new Date(r.respondedAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }
}
