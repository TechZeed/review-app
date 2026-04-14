export interface OptInInput {
  reviewId: string;
  reviewerPhoneHash: string;
}

export interface WithdrawInput {
  referenceId: string;
}

export interface ContactReferenceInput {
  referenceId: string;
  companyName: string;
  roleTitle: string;
  message: string;
}

export interface ReferenceResponse {
  id: string;
  reviewId: string;
  isContactable: boolean;
  optedInAt: string;
  withdrawnAt: string | null;
  contactCount: number;
  nonResponseCount: number;
  badgeState: 'active' | 'unresponsive' | 'withdrawn';
}

export interface ReferenceRequestResponse {
  requestId: string;
  referenceId: string;
  status: string;
  expiresAt: string;
}

export interface ProfileReferenceSummary {
  profileId: string;
  totalReferences: number;
  activeReferences: number;
  unresponsiveReferences: number;
  references: ReferenceResponse[];
}
