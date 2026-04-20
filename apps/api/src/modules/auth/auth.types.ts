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

export interface PasswordLoginInput {
  email: string;
  password: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: 'INDIVIDUAL' | 'EMPLOYER' | 'RECRUITER' | 'ADMIN';
  phone?: string;
}

export interface RoleRequestInput {
  requestedRole: 'EMPLOYER' | 'RECRUITER';
  companyName: string;
  companyWebsite: string;
  reason: string;
}

export interface UpdateRoleInput {
  role: 'INDIVIDUAL' | 'EMPLOYER' | 'RECRUITER' | 'ADMIN';
}

export interface UpdateStatusInput {
  status: 'active' | 'suspended';
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
  provider?: string;
  capabilities?: string[];
  iat?: number;
  exp?: number;
}
