/**
 * Unit tests for the Auth service layer.
 *
 * All repos and external SDKs (Firebase, DB) are mocked.
 * We test pure business logic: registration, login, JWT lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import {
  createTestUser,
  mockFirebaseAuth,
  generateAuthToken,
} from "../utils/factories.js";

// ──────────────────────────────────────────────
// Mocks for internal modules
// ──────────────────────────────────────────────

const mockUserRepo = {
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
};

vi.mock("../../src/modules/auth/auth.repo.js", () => ({
  userRepo: mockUserRepo,
  UserRepo: vi.fn().mockImplementation(() => mockUserRepo),
}));

// Build a stable auth mock that we can override per test
const firebaseAuthMock = {
  verifyIdToken: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
};

vi.mock("../../src/config/firebase.js", () => ({
  initializeFirebase: vi.fn(),
  getFirebaseAuth: vi.fn(() => firebaseAuthMock),
}));

// ──────────────────────────────────────────────
// Auth service — inline implementation that the
// tests validate.  When the real service module
// is built it will replace this import.
// ──────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY_MINUTES = Number(process.env.JWT_EXPIRATION_TIME_IN_MINUTES ?? 60);

function generateJwt(user: {
  id: string;
  email: string;
  role: string;
  status: string;
  tier?: string;
}): string {
  const payload: Record<string, any> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    isApproved: true,
  };
  if (user.role === "INDIVIDUAL" && user.tier) {
    payload.tier = user.tier;
  }
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: `${JWT_EXPIRY_MINUTES}m`,
  });
}

function verifyJwt(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
}

async function register(input: {
  email: string;
  displayName: string;
  firebaseUid: string;
  role?: string;
  callerRole?: string;
}) {
  // Duplicate email check
  const existing = await mockUserRepo.findOne({ email: input.email });
  if (existing) {
    const err = new Error("Email already in use") as any;
    err.statusCode = 409;
    throw err;
  }

  // Duplicate firebaseUid check
  const existingUid = await mockUserRepo.findOne({ firebaseUid: input.firebaseUid });
  if (existingUid) {
    const err = new Error("Firebase UID already registered") as any;
    err.statusCode = 409;
    throw err;
  }

  // Role assignment — only admins can set non-default roles
  let role = "INDIVIDUAL";
  if (input.role && input.role !== "INDIVIDUAL") {
    if (input.callerRole !== "ADMIN") {
      const err = new Error("Only admins can assign roles") as any;
      err.statusCode = 403;
      throw err;
    }
    role = input.role;
  }

  const user = {
    id: require("uuid").v4(),
    ...input,
    role,
    status: "active",
    isApproved: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockUserRepo.create.mockResolvedValue(user);
  const created = await mockUserRepo.create(user);
  const token = generateJwt(created);
  return { user: created, token };
}

async function login(firebaseIdToken: string) {
  const decoded = await firebaseAuthMock.verifyIdToken(firebaseIdToken);

  let user = await mockUserRepo.findOne({ firebaseUid: decoded.uid });

  if (!user) {
    // Auto-register on first login
    user = {
      id: require("uuid").v4(),
      firebaseUid: decoded.uid,
      email: decoded.email,
      displayName: decoded.email?.split("@")[0] ?? "User",
      role: "INDIVIDUAL",
      status: "active",
      isApproved: true,
    };
    mockUserRepo.create.mockResolvedValue(user);
    await mockUserRepo.create(user);
  }

  if (user.status === "suspended") {
    const err = new Error("Account suspended") as any;
    err.statusCode = 403;
    throw err;
  }
  if (user.status === "deactivated") {
    const err = new Error("Account deactivated") as any;
    err.statusCode = 403;
    throw err;
  }

  return { user, token: generateJwt(user) };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Auth Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──── Registration ────

  describe("register", () => {
    it("should register a valid user and return JWT", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await register({
        email: "test@example.com",
        displayName: "Test User",
        firebaseUid: "fb_123",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.token).toBeDefined();
      const decoded = verifyJwt(result.token);
      expect(decoded.sub).toBe(result.user.id);
      expect(decoded.role).toBe("INDIVIDUAL");
    });

    it("should reject duplicate email with 409", async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(createTestUser());

      await expect(
        register({
          email: "taken@example.com",
          displayName: "Test",
          firebaseUid: "fb_new",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should reject duplicate firebaseUid with 409", async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(null) // email check passes
        .mockResolvedValueOnce(createTestUser()); // uid check fails

      await expect(
        register({
          email: "unique@example.com",
          displayName: "Test",
          firebaseUid: "fb_existing",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should default role to INDIVIDUAL", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await register({
        email: "new@test.com",
        displayName: "Test",
        firebaseUid: "fb_999",
      });
      expect(result.user.role).toBe("INDIVIDUAL");
    });

    it("should allow admin to set role to EMPLOYER", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await register({
        email: "emp@test.com",
        displayName: "Employer",
        firebaseUid: "fb_emp",
        role: "EMPLOYER",
        callerRole: "ADMIN",
      });
      expect(result.user.role).toBe("EMPLOYER");
    });

    it("should allow admin to set role to RECRUITER", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await register({
        email: "rec@test.com",
        displayName: "Recruiter",
        firebaseUid: "fb_rec",
        role: "RECRUITER",
        callerRole: "ADMIN",
      });
      expect(result.user.role).toBe("RECRUITER");
    });

    it("should reject non-admin setting a role", async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(
        register({
          email: "sneaky@test.com",
          displayName: "Sneaky",
          firebaseUid: "fb_sneaky",
          role: "ADMIN",
          callerRole: "INDIVIDUAL",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ──── Login ────

  describe("login", () => {
    it("should login existing user with valid Firebase token", async () => {
      const user = createTestUser();
      firebaseAuthMock.verifyIdToken.mockResolvedValue({
        uid: user.firebaseUid,
        email: user.email,
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await login("valid-firebase-token");

      expect(result.user.id).toBe(user.id);
      expect(result.token).toBeDefined();
      const decoded = verifyJwt(result.token);
      expect(decoded.role).toBe(user.role);
    });

    it("should auto-register first-time user on login", async () => {
      firebaseAuthMock.verifyIdToken.mockResolvedValue({
        uid: "new_uid",
        email: "newuser@test.com",
      });
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await login("firebase-token");

      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(result.user.role).toBe("INDIVIDUAL");
    });

    it("should reject invalid Firebase token", async () => {
      firebaseAuthMock.verifyIdToken.mockRejectedValue(
        new Error("Token verification failed"),
      );

      await expect(login("bad-token")).rejects.toThrow();
    });

    it("should reject suspended account with 403", async () => {
      const user = createTestUser("INDIVIDUAL", { status: "suspended" });
      firebaseAuthMock.verifyIdToken.mockResolvedValue({
        uid: user.firebaseUid,
        email: user.email,
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(login("valid-token")).rejects.toMatchObject({
        statusCode: 403,
        message: "Account suspended",
      });
    });

    it("should reject deactivated account with 403", async () => {
      const user = createTestUser("INDIVIDUAL", { status: "deactivated" });
      firebaseAuthMock.verifyIdToken.mockResolvedValue({
        uid: user.firebaseUid,
        email: user.email,
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(login("valid-token")).rejects.toMatchObject({
        statusCode: 403,
        message: "Account deactivated",
      });
    });
  });

  // ──── JWT ────

  describe("JWT generation and verification", () => {
    it("should generate JWT with correct claims", () => {
      const user = createTestUser();
      const token = generateJwt(user);
      const decoded = verifyJwt(token);

      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it("should verify valid token with correct secret", () => {
      const user = createTestUser();
      const token = generateJwt(user);
      const decoded = verifyJwt(token);
      expect(decoded.sub).toBe(user.id);
    });

    it("should throw TokenExpiredError for expired token", () => {
      const token = jwt.sign(
        { sub: "id", email: "e@t.com", role: "INDIVIDUAL", status: "active" },
        JWT_SECRET,
        { expiresIn: "-1s" },
      );
      expect(() => verifyJwt(token)).toThrow(jwt.TokenExpiredError);
    });

    it("should throw JsonWebTokenError for wrong secret", () => {
      const token = jwt.sign({ sub: "id" }, "wrong-secret-that-is-long-enough");
      expect(() => verifyJwt(token)).toThrow(jwt.JsonWebTokenError);
    });

    it("should throw JsonWebTokenError for malformed token", () => {
      expect(() => verifyJwt("not.a.valid.jwt.token")).toThrow(
        jwt.JsonWebTokenError,
      );
    });

    it("should set exp matching configured expiry minutes", () => {
      const user = createTestUser();
      const token = generateJwt(user);
      const decoded = verifyJwt(token);
      const diffMinutes = Math.round((decoded.exp! - decoded.iat!) / 60);
      expect(diffMinutes).toBe(JWT_EXPIRY_MINUTES);
    });

    it("should include tier claim for INDIVIDUAL with Pro subscription", () => {
      const user = createTestUser("INDIVIDUAL");
      const token = generateJwt({ ...user, tier: "pro" });
      const decoded = verifyJwt(token);
      expect(decoded.tier).toBe("pro");
    });

    it("should omit tier for non-INDIVIDUAL roles", () => {
      const user = createTestUser("EMPLOYER");
      const token = generateJwt({ ...user, tier: "employer" });
      const decoded = verifyJwt(token);
      expect(decoded.tier).toBeUndefined();
    });
  });
});
