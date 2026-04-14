import jwt from 'jsonwebtoken';
import { AuthRepo } from './auth.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import { env } from '../../config/env.js';
import { getFirebaseAuth } from '../../config/firebase.js';
import type { RegisterInput, LoginInput, AuthPayload, JwtClaims } from './auth.types.js';

export class AuthService {
  constructor(private repo: AuthRepo) {}

  /**
   * Verify a Firebase ID token and return decoded claims
   */
  async verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string; name?: string }> {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? decoded.email?.split('@')[0],
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
      role,
      status: 'active',
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

    // Check account status
    if (user.getDataValue('status') === 'suspended') {
      throw new AppError('Account has been suspended', 403, 'ACCOUNT_SUSPENDED');
    }

    if (user.getDataValue('status') === 'deactivated') {
      throw new AppError('Account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

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
   * Transform user model to response format
   */
  private toUserResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
      status: user.status,
      isApproved: user.status === 'active',
      isActive: user.status === 'active',
    };
  }
}
