import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AuthRepo, RoleRequestRepo } from './auth.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import { env } from '../../config/env.js';
import { getFirebaseAuth } from '../../config/firebase.js';
import type {
  RegisterInput,
  LoginInput,
  PasswordLoginInput,
  CreateUserInput,
  RoleRequestInput,
  AuthPayload,
  JwtClaims,
} from './auth.types.js';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  private roleRequestRepo: RoleRequestRepo;

  constructor(private repo: AuthRepo) {
    this.roleRequestRepo = new RoleRequestRepo();
  }

  /**
   * Verify a Firebase ID token and return decoded claims
   */
  async verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string; name?: string; picture?: string }> {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? decoded.email?.split('@')[0],
        picture: decoded.picture,
      };
    } catch (error: any) {
      if (
        error instanceof Error &&
        (error.message?.includes('Firebase not initialized') ||
          error.message?.includes('FIREBASE_SERVICE_ACCOUNT'))
      ) {
        throw new AppError('Authentication provider not configured', 500, 'FIREBASE_NOT_CONFIGURED');
      }
      throw new AppError('Invalid Firebase token', 401, 'INVALID_FIREBASE_TOKEN');
    }
  }

  /**
   * Issue a custom HS256 JWT with role + tier claims
   */
  issueJwt(user: any): string {
    const payload: JwtClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.status === 'active',
      status: user.status,
      tier: user.tier ?? 'free',
      provider: user.provider ?? 'google',
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: `${env.JWT_EXPIRATION_TIME_IN_MINUTES}m`,
    } as jwt.SignOptions);
  }

  /**
   * Register a new user (create in DB after Firebase token verification)
   */
  async registerUser(data: RegisterInput): Promise<AuthPayload> {
    // Verify Firebase token
    const firebaseClaims = await this.verifyFirebaseToken(data.firebaseToken);

    // Check if user already exists
    const existingUser = await this.repo.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const existingByUid = await this.repo.findByFirebaseUid(firebaseClaims.uid);
    if (existingByUid) {
      throw new AppError('Account already exists', 409, 'ACCOUNT_EXISTS');
    }

    // Map role to DB format (uppercase to match model validation)
    const role = (data.role ?? 'individual').toUpperCase();

    // Create user
    const user = await this.repo.create({
      firebaseUid: firebaseClaims.uid,
      email: data.email,
      displayName: data.name,
      phone: data.phone ?? null,
      provider: 'google',
      role,
      status: 'active',
      avatarUrl: firebaseClaims.picture ?? null,
      lastLoginAt: new Date(),
    } as any);

    const accessToken = this.issueJwt(user);

    return {
      user: this.toUserResponse(user),
      accessToken,
    };
  }

  /**
   * Login an existing user (verify Firebase token, find user, issue JWT)
   */
  async loginUser(data: LoginInput): Promise<AuthPayload> {
    // Verify Firebase token
    const firebaseClaims = await this.verifyFirebaseToken(data.firebaseToken);

    // Find user by Firebase UID
    let user = await this.repo.findByFirebaseUid(firebaseClaims.uid);
    if (!user) {
      // Try to find by email (in case of provider migration)
      user = await this.repo.findByEmail(firebaseClaims.email);
    }

    if (!user) {
      throw new AppError('User not found. Please register first.', 404, 'USER_NOT_FOUND');
    }

    this.checkAccountStatus(user);

    // Update last login and firebase UID if needed
    const updates: any = { lastLoginAt: new Date() };
    if (!user.getDataValue('firebaseUid')) {
      updates.firebaseUid = firebaseClaims.uid;
    }
    await user.update(updates);

    const accessToken = this.issueJwt(user);

    return {
      user: this.toUserResponse(user),
      accessToken,
    };
  }

  /**
   * Exchange Firebase ID token for app JWT (auto-create user on first login)
   */
  async exchangeFirebaseToken(firebaseToken: string): Promise<AuthPayload> {
    if (!firebaseToken) {
      throw new AppError('Firebase token is required', 400, 'INVALID_FIREBASE_TOKEN');
    }

    const firebaseClaims = await this.verifyFirebaseToken(firebaseToken);

    let user = await this.repo.findByFirebaseUid(firebaseClaims.uid);

    if (!user) {
      user = await this.repo.findByEmail(firebaseClaims.email);
    }

    if (user) {
      this.checkAccountStatus(user);

      // Update last login and firebase UID if needed
      const updates: any = { lastLoginAt: new Date() };
      if (!user.getDataValue('firebaseUid')) {
        updates.firebaseUid = firebaseClaims.uid;
      }
      if (firebaseClaims.picture && !user.getDataValue('avatarUrl')) {
        updates.avatarUrl = firebaseClaims.picture;
      }
      await user.update(updates);
    } else {
      // Auto-create user on first Google login
      user = await this.repo.create({
        firebaseUid: firebaseClaims.uid,
        email: firebaseClaims.email,
        displayName: firebaseClaims.name || firebaseClaims.email.split('@')[0],
        provider: 'google',
        role: 'INDIVIDUAL',
        status: 'active',
        avatarUrl: firebaseClaims.picture ?? null,
        lastLoginAt: new Date(),
      } as any);
    }

    const accessToken = this.issueJwt(user);

    return {
      user: this.toUserResponse(user),
      accessToken,
    };
  }

  /**
   * Login with email and password (for admin-created internal accounts)
   */
  async loginWithPassword(data: PasswordLoginInput): Promise<AuthPayload> {
    const user = await this.repo.findByEmail(data.email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.getDataValue('provider') !== 'internal') {
      throw new AppError('This account uses Google sign-in', 400, 'WRONG_PROVIDER');
    }

    const passwordHash = user.getDataValue('passwordHash');
    if (!passwordHash) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(data.password, passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    this.checkAccountStatus(user);

    await user.update({ lastLoginAt: new Date() });

    const accessToken = this.issueJwt(user);

    return {
      user: this.toUserResponse(user),
      accessToken,
    };
  }

  /**
   * Create email/password user (admin only)
   */
  async createUserByAdmin(data: CreateUserInput): Promise<AuthPayload> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.repo.create({
      email: data.email,
      displayName: data.name,
      provider: 'internal',
      passwordHash,
      role: data.role,
      status: 'active',
      lastLoginAt: null,
    } as any);

    const accessToken = this.issueJwt(user);

    return {
      user: this.toUserResponse(user),
      accessToken,
    };
  }

  /**
   * Request a role upgrade (INDIVIDUAL -> EMPLOYER/RECRUITER)
   */
  async requestRoleUpgrade(userId: string, data: RoleRequestInput): Promise<any> {
    const existing = await this.roleRequestRepo.findPendingByUserId(userId);
    if (existing) {
      throw new AppError('You already have a pending role request', 409, 'ROLE_REQUEST_EXISTS');
    }

    const roleRequest = await this.roleRequestRepo.create({
      userId,
      requestedRole: data.requestedRole,
      companyName: data.companyName,
      companyWebsite: data.companyWebsite,
      reason: data.reason,
      status: 'pending',
    } as any);

    return roleRequest;
  }

  /**
   * Get the current user's pending role request
   */
  async getMyRoleRequest(userId: string): Promise<any> {
    const request = await this.roleRequestRepo.findPendingByUserId(userId);
    return request;
  }

  /**
   * List all pending role requests (admin)
   */
  async listRoleRequests(): Promise<any[]> {
    return this.roleRequestRepo.findAllPending();
  }

  /**
   * Approve a role request (admin)
   */
  async approveRoleRequest(requestId: string, adminId: string): Promise<any> {
    const request = await this.roleRequestRepo.findById(requestId);
    if (!request) {
      throw new AppError('Role request not found', 404, 'ROLE_REQUEST_NOT_FOUND');
    }

    if (request.getDataValue('status') !== 'pending') {
      throw new AppError('Role request is not pending', 400, 'ROLE_REQUEST_NOT_PENDING');
    }

    await request.update({
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    });

    // Update the user's role
    const userId = request.getDataValue('userId');
    const requestedRole = request.getDataValue('requestedRole');
    await this.repo.update(userId, { role: requestedRole });

    return request;
  }

  /**
   * Reject a role request (admin)
   */
  async rejectRoleRequest(requestId: string, adminId: string): Promise<any> {
    const request = await this.roleRequestRepo.findById(requestId);
    if (!request) {
      throw new AppError('Role request not found', 404, 'ROLE_REQUEST_NOT_FOUND');
    }

    if (request.getDataValue('status') !== 'pending') {
      throw new AppError('Role request is not pending', 400, 'ROLE_REQUEST_NOT_PENDING');
    }

    await request.update({
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    });

    return request;
  }

  /**
   * List all users (admin)
   */
  async listUsers(): Promise<any[]> {
    const users = await this.repo.findAllUsers();
    return users.map((u) => this.toUserResponse(u));
  }

  /**
   * Update a user's role (admin)
   */
  async updateUserRole(userId: string, role: string): Promise<any> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await user.update({ role } as any);
    return this.toUserResponse(user);
  }

  /**
   * Update a user's status (admin — activate/suspend)
   */
  async updateUserStatus(userId: string, status: string): Promise<any> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await user.update({ status } as any);
    return this.toUserResponse(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return this.toUserResponse(user);
  }

  /**
   * Check account status and throw if not active
   */
  private checkAccountStatus(user: any): void {
    if (user.getDataValue('status') === 'suspended') {
      throw new AppError('Account has been suspended', 403, 'ACCOUNT_SUSPENDED');
    }
    if (user.getDataValue('status') === 'inactive') {
      throw new AppError('Account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }
  }

  /**
   * Transform user model to response format
   */
  private toUserResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
      status: user.status,
      provider: user.provider ?? 'google',
      avatarUrl: user.avatarUrl ?? null,
      isApproved: user.status === 'active',
      isActive: user.status === 'active',
    };
  }
}
