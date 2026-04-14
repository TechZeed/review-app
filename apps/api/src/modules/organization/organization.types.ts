export enum OrgMemberStatus {
  ACTIVE = 'active',
  FORMER = 'former',
}

export interface CreateOrgInput {
  name: string;
  industry: string;
  website?: string;
  location: {
    city: string;
    state?: string;
    country: string;
  };
  size?: '1-25' | '26-100' | '101-500' | '500+';
}

export interface TagInput {
  profileId?: string;
  organizationId?: string;
  role: string;
}

export interface OrgResponse {
  id: string;
  name: string;
  industry: string;
  website?: string;
  location: {
    city: string;
    state?: string;
    country: string;
  };
  size?: string;
  teamCount?: number;
  createdAt: string;
}

export interface OrgMemberResponse {
  id: string;
  profileId: string;
  organizationId: string;
  role: string;
  status: OrgMemberStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
}
