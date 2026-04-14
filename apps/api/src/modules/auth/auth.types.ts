export enum UserRole {
  INDIVIDUAL = 'INDIVIDUAL',
  EMPLOYER = 'EMPLOYER',
  RECRUITER = 'RECRUITER',
  ADMIN = 'ADMIN',
}

export interface RegisterInput {
  email: string;
  name: string;
  role: 'individual' | 'recruiter' | 'employer';
  phone?: string;
  firebaseToken: string;
  industry?: string;
  organizationName?: string;
}

export interface LoginInput {
  firebaseToken: string;
}

export interface AuthPayload {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    isApproved: boolean;
    isActive: boolean;
  };
  accessToken: string;
  profile?: {
    id: string;
    slug: string;
  };
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  isApproved: boolean;
  status: string;
  tier?: string;
  iat?: number;
  exp?: number;
}
