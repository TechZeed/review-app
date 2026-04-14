import { ReferenceRepository } from './reference.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import type {
  OptInInput,
  ReferenceResponse,
  ContactReferenceInput,
  ReferenceRequestResponse,
  ProfileReferenceSummary,
} from './reference.types.js';

export class ReferenceService {
  constructor(private repo: ReferenceRepository) {}

  async optIn(input: OptInInput): Promise<ReferenceResponse> {
    // Verify review exists and phone hash matches
    const reviewExists = await this.repo.reviewExistsWithPhone(
      input.reviewId,
      input.reviewerPhoneHash,
    );
    if (!reviewExists) {
      throw new AppError('Review not found or phone hash mismatch', 404, 'REVIEW_NOT_FOUND');
    }

    // Check for duplicate opt-in
    const existing = await this.repo.findByReview(input.reviewId);
    if (existing) {
      throw new AppError('Already opted in for this review', 409, 'ALREADY_OPTED_IN');
    }

    // Create verifiable reference
    const ref = await this.repo.createReference({
      reviewId: input.reviewId,
      reviewerPhoneHash: input.reviewerPhoneHash,
    });

    return this.toResponse(ref);
  }

  async withdraw(referenceId: string): Promise<ReferenceResponse> {
    const ref = await this.repo.findById(referenceId);
    if (!ref) {
      throw new AppError('Reference not found', 404, 'REFERENCE_NOT_FOUND');
    }

    if (!ref.isContactable) {
      throw new AppError('Reference already withdrawn', 400, 'ALREADY_WITHDRAWN');
    }

    // Withdraw in a logical transaction sequence
    await this.repo.withdrawReference(referenceId);
    await this.repo.cancelPendingRequests(referenceId);
    await this.repo.closeActiveConversations(referenceId);

    const updated = await this.repo.findById(referenceId);
    return this.toResponse(updated!);
  }

  async requestContact(
    recruiterUserId: string,
    input: ContactReferenceInput,
  ): Promise<ReferenceRequestResponse> {
    // Verify reference exists and is contactable
    const ref = await this.repo.findById(input.referenceId);
    if (!ref || !ref.isContactable) {
      throw new AppError('Reference not found or not contactable', 404, 'REFERENCE_NOT_FOUND');
    }

    // Check recruiter daily rate limit (10/day)
    const dailyCount = await this.repo.countRecruiterDailyRequests(recruiterUserId);
    if (dailyCount >= 10) {
      throw new AppError(
        'Daily reference request limit exceeded (10/day)',
        429,
        'RECRUITER_DAILY_LIMIT',
      );
    }

    // Check per-review lifetime limit (3 total)
    const lifetimeCount = await this.repo.countReviewLifetimeRequests(input.referenceId);
    if (lifetimeCount >= 3) {
      throw new AppError(
        'Maximum requests for this reference reached (3 total)',
        429,
        'REVIEW_REQUEST_LIMIT',
      );
    }

    // Check customer monthly limit (5/month)
    const monthlyCount = await this.repo.countCustomerMonthlyRequests(ref.reviewerPhoneHash);
    if (monthlyCount >= 5) {
      throw new AppError(
        'Customer monthly contact limit reached (5/month)',
        429,
        'CUSTOMER_MONTHLY_LIMIT',
      );
    }

    // Create the reference request
    const request = await this.repo.createReferenceRequest({
      referenceId: input.referenceId,
      recruiterUserId,
      companyName: input.companyName,
      roleTitle: input.roleTitle,
      message: input.message,
    });

    return {
      requestId: request.requestId,
      referenceId: request.referenceId,
      status: request.status,
      expiresAt: new Date(request.expiresAt).toISOString(),
    };
  }

  async getByProfile(profileId: string): Promise<ProfileReferenceSummary> {
    const references = await this.repo.findByProfile(profileId);

    const mapped = references.map((ref: any) => this.toResponse(ref));
    const active = mapped.filter((r) => r.badgeState === 'active');
    const unresponsive = mapped.filter((r) => r.badgeState === 'unresponsive');

    return {
      profileId,
      totalReferences: mapped.length,
      activeReferences: active.length,
      unresponsiveReferences: unresponsive.length,
      references: mapped,
    };
  }

  private toResponse(ref: any): ReferenceResponse {
    const isWithdrawn = !ref.isContactable && ref.withdrawnAt;
    const isUnresponsive = ref.isContactable && ref.nonResponseCount >= 3;

    let badgeState: 'active' | 'unresponsive' | 'withdrawn' = 'active';
    if (isWithdrawn) {
      badgeState = 'withdrawn';
    } else if (isUnresponsive) {
      badgeState = 'unresponsive';
    }

    return {
      id: ref.id,
      reviewId: ref.reviewId,
      isContactable: Boolean(ref.isContactable),
      optedInAt: new Date(ref.optedInAt).toISOString(),
      withdrawnAt: ref.withdrawnAt ? new Date(ref.withdrawnAt).toISOString() : null,
      contactCount: Number(ref.contactCount),
      nonResponseCount: Number(ref.nonResponseCount),
      badgeState,
    };
  }
}
