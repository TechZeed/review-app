/**
 * Integration test seed.
 *
 * Inserts deterministic fixtures into a Testcontainers Postgres database so
 * the integration suite can:
 *   - Log in via /auth/login (email + password, internal provider) for each role.
 *   - Exercise scan/review flows against an existing profile.
 *   - Exercise cooldown/reuse scenarios against a "veteran" profile.
 *
 * Idempotent: deletes its own rows by deterministic id/email before insert,
 * so running it multiple times against the same DB is safe.
 *
 * Owned by the Seed Creator agent. Do not import test-harness or
 * Testcontainers code from this file.
 */

import bcrypt from "bcrypt";
import { Op, type Sequelize } from "sequelize";

// ── Public contract ────────────────────────────────────────────────────────

export interface SeededTestData {
  users: {
    admin: { id: string; email: string };
    individual: { id: string; email: string; profileSlug: string };
    employer: { id: string; email: string };
    recruiter: { id: string; email: string };
  };
  profiles: {
    primary: { id: string; slug: string };
    secondary: { id: string; slug: string };
  };
  org: { id: string; slug: string };
}

// ── Deterministic IDs (UUID v4 shape, hand-picked so tests can hard-code) ──

const USER_IDS = {
  admin:      "11111111-1111-4111-8111-111111111111",
  individual: "22222222-2222-4222-8222-222222222222",
  employer:   "33333333-3333-4333-8333-333333333333",
  recruiter:  "44444444-4444-4444-8444-444444444444",
} as const;

const PROFILE_IDS = {
  primary:   "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  secondary: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

const ORG_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const SUBSCRIPTION_IDS = {
  individual: "dddddddd-dddd-4ddd-8ddd-ddddddddd001",
  employer:   "dddddddd-dddd-4ddd-8ddd-ddddddddd002",
  recruiter:  "dddddddd-dddd-4ddd-8ddd-ddddddddd003",
  admin:      "dddddddd-dddd-4ddd-8ddd-ddddddddd004",
} as const;

const PROFILE_ORG_IDS = {
  primary:   "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
  secondary: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
} as const;

const QUALITY_IDS = {
  expertise:  "ffffffff-ffff-4fff-8fff-fffffffff001",
  care:       "ffffffff-ffff-4fff-8fff-fffffffff002",
  delivery:   "ffffffff-ffff-4fff-8fff-fffffffff003",
  initiative: "ffffffff-ffff-4fff-8fff-fffffffff004",
  trust:      "ffffffff-ffff-4fff-8fff-fffffffff005",
} as const;

// ── Test user definitions (passwords are hashed at seed time) ─────────────

interface TestUserSpec {
  id: string;
  email: string;
  password: string;
  displayName: string;
  role: "ADMIN" | "INDIVIDUAL" | "EMPLOYER" | "RECRUITER";
  tier: string;
}

const TEST_USERS: TestUserSpec[] = [
  {
    id: USER_IDS.admin,
    email: "admin@test.local",
    password: "Test_Admin_Pass_007",
    displayName: "Test Admin",
    role: "ADMIN",
    tier: "ADMIN",
  },
  {
    id: USER_IDS.individual,
    email: "individual@test.local",
    password: "Test_Individual_Pass_007",
    displayName: "Test Individual",
    role: "INDIVIDUAL",
    tier: "FREE",
  },
  {
    id: USER_IDS.employer,
    email: "employer@test.local",
    password: "Test_Employer_Pass_007",
    displayName: "Test Employer",
    role: "EMPLOYER",
    tier: "EMPLOYER_DASHBOARD",
  },
  {
    id: USER_IDS.recruiter,
    email: "recruiter@test.local",
    password: "Test_Recruiter_Pass_007",
    displayName: "Test Recruiter",
    role: "RECRUITER",
    tier: "RECRUITER_ACCESS",
  },
];

const TEST_EMAILS = TEST_USERS.map((u) => u.email);
const TEST_USER_IDS = TEST_USERS.map((u) => u.id);
const TEST_PROFILE_IDS = [PROFILE_IDS.primary, PROFILE_IDS.secondary];

// Org slug is part of the test contract but the `organizations` table only
// has a `name` column. We persist the slug as the org's `name` so it is both
// human-readable in the DB and trivially round-trippable from the fixture.
const ORG_SLUG = "test-co";
const ORG_NAME = ORG_SLUG;

const PRIMARY_PROFILE_SLUG = "test-individual-primary";
const SECONDARY_PROFILE_SLUG = "test-individual-veteran";

// Match the production auth path (apps/api/src/modules/auth/auth.service.ts).
const BCRYPT_ROUNDS = 12;

// ── Public fixture accessor ────────────────────────────────────────────────

/**
 * Return the deterministic fixture handles tests should use. Safe to call
 * without touching the database — assumes the DB has been seeded by
 * `seedTestData` (typically via `task test:db:seed` or `seed-cli.ts`).
 */
export function getSeededTestData(): SeededTestData {
  return {
    users: {
      admin:      { id: USER_IDS.admin,      email: "admin@test.local" },
      individual: { id: USER_IDS.individual, email: "individual@test.local", profileSlug: PRIMARY_PROFILE_SLUG },
      employer:   { id: USER_IDS.employer,   email: "employer@test.local" },
      recruiter:  { id: USER_IDS.recruiter,  email: "recruiter@test.local" },
    },
    profiles: {
      primary:   { id: PROFILE_IDS.primary,   slug: PRIMARY_PROFILE_SLUG },
      secondary: { id: PROFILE_IDS.secondary, slug: SECONDARY_PROFILE_SLUG },
    },
    org: { id: ORG_ID, slug: ORG_SLUG },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function tableExists(sequelize: Sequelize, table: string): Promise<boolean> {
  try {
    await sequelize.getQueryInterface().describeTable(table);
    return true;
  } catch {
    return false;
  }
}

async function clearExistingTestData(sequelize: Sequelize): Promise<void> {
  const qi = sequelize.getQueryInterface();

  // FK-safe order: leaves first.
  if (await tableExists(sequelize, "quality_scores")) {
    await qi.bulkDelete("quality_scores", { profile_id: { [Op.in]: TEST_PROFILE_IDS } } as any);
  }
  if (await tableExists(sequelize, "subscriptions")) {
    await qi.bulkDelete("subscriptions", { user_id: { [Op.in]: TEST_USER_IDS } } as any);
  }
  if (await tableExists(sequelize, "profile_organizations")) {
    await qi.bulkDelete("profile_organizations", { profile_id: { [Op.in]: TEST_PROFILE_IDS } } as any);
  }
  if (await tableExists(sequelize, "profiles")) {
    await qi.bulkDelete("profiles", { id: { [Op.in]: TEST_PROFILE_IDS } } as any);
  }
  if (await tableExists(sequelize, "organizations")) {
    await qi.bulkDelete("organizations", { id: ORG_ID } as any);
  }
  if (await tableExists(sequelize, "users")) {
    await qi.bulkDelete("users", { email: { [Op.in]: TEST_EMAILS } } as any);
  }
}

// ── Main entry ─────────────────────────────────────────────────────────────

export async function seedTestData(sequelize: Sequelize): Promise<SeededTestData> {
  const qi = sequelize.getQueryInterface();
  const now = new Date();

  await clearExistingTestData(sequelize);

  // 1) Users (internal provider, real bcrypt hashes so /auth/login works).
  const userRows = await Promise.all(
    TEST_USERS.map(async (u) => ({
      id: u.id,
      firebase_uid: null,
      email: u.email,
      phone: null,
      display_name: u.displayName,
      provider: "internal",
      password_hash: await bcrypt.hash(u.password, BCRYPT_ROUNDS),
      role: u.role,
      status: "active",
      avatar_url: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    })),
  );
  await qi.bulkInsert("users", userRows);

  // 2) Organization. The schema has no `slug` column — we use the slug as the
  //    `name` so tests can resolve the org by slug via the returned handle.
  await qi.bulkInsert("organizations", [
    {
      id: ORG_ID,
      name: ORG_NAME,
      industry: "general",
      location: "Test City, Testland",
      logo_url: null,
      website: null,
      created_at: now,
      updated_at: now,
    },
  ]);

  // 3) Profiles for the individual user.
  //    NOTE: `profiles.user_id` is UNIQUE, so both profiles cannot belong to
  //    the same user at the schema level. We attach `secondary` to the
  //    EMPLOYER user (still a deterministic, test-only profile) so cooldown
  //    scenarios have a "veteran" profile to target without violating the
  //    unique constraint. The contract returns slugs/ids only; consumers
  //    don't assume secondary.user_id == individual.id.
  await qi.bulkInsert("profiles", [
    {
      id: PROFILE_IDS.primary,
      user_id: USER_IDS.individual,
      slug: PRIMARY_PROFILE_SLUG,
      headline: "Fresh test profile",
      bio: "Primary profile used by integration tests for happy-path scans.",
      industry: "general",
      location: "Test City, Testland",
      qr_code_url: null,
      visibility: "public",
      is_verified: false,
      total_reviews: 0,
      expertise_count: 0,
      care_count: 0,
      delivery_count: 0,
      initiative_count: 0,
      trust_count: 0,
      created_at: now,
      updated_at: now,
    },
    {
      id: PROFILE_IDS.secondary,
      user_id: USER_IDS.employer,
      slug: SECONDARY_PROFILE_SLUG,
      headline: "Veteran test profile",
      bio: "Secondary profile pre-populated with review counts for cooldown/reuse tests.",
      industry: "general",
      location: "Test City, Testland",
      qr_code_url: null,
      visibility: "public",
      is_verified: true,
      total_reviews: 12,
      expertise_count: 5,
      care_count: 3,
      delivery_count: 2,
      initiative_count: 1,
      trust_count: 1,
      created_at: now,
      updated_at: now,
    },
  ]);

  // 4) Profile <-> organization association (current employer for both).
  await qi.bulkInsert("profile_organizations", [
    {
      id: PROFILE_ORG_IDS.primary,
      profile_id: PROFILE_IDS.primary,
      organization_id: ORG_ID,
      role_title: "Test Engineer",
      is_current: true,
      tagged_at: now,
      untagged_at: null,
    },
    {
      id: PROFILE_ORG_IDS.secondary,
      profile_id: PROFILE_IDS.secondary,
      organization_id: ORG_ID,
      role_title: "Senior Test Engineer",
      is_current: true,
      tagged_at: now,
      untagged_at: null,
    },
  ]);

  // 5) Subscriptions encode the per-user "tier" from the contract.
  await qi.bulkInsert("subscriptions", [
    {
      id: SUBSCRIPTION_IDS.admin,
      user_id: USER_IDS.admin,
      tier: "ADMIN",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "active",
      current_period_start: now,
      current_period_end: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: SUBSCRIPTION_IDS.individual,
      user_id: USER_IDS.individual,
      tier: "FREE",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "active",
      current_period_start: now,
      current_period_end: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: SUBSCRIPTION_IDS.employer,
      user_id: USER_IDS.employer,
      tier: "EMPLOYER_DASHBOARD",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "active",
      current_period_start: now,
      current_period_end: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: SUBSCRIPTION_IDS.recruiter,
      user_id: USER_IDS.recruiter,
      tier: "RECRUITER_ACCESS",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      status: "active",
      current_period_start: now,
      current_period_end: null,
      created_at: now,
      updated_at: now,
    },
  ]);

  // 6) Qualities — only insert if the table exists AND is empty.
  //    Migrations create the table but do not populate it; the dev seed does.
  //    We avoid clobbering rows that another seeder already inserted.
  if (await tableExists(sequelize, "qualities")) {
    const [existing] = await sequelize.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM qualities",
    );
    const count = Number((existing as unknown as Array<{ count: string }>)[0]?.count ?? 0);
    if (count === 0) {
      await qi.bulkInsert("qualities", [
        { id: QUALITY_IDS.expertise,  name: "expertise",  label: "Expertise",  description: "Deep knowledge and skill in their domain",      customer_language: "Expert in their domain",      sort_order: 1, created_at: now, updated_at: now },
        { id: QUALITY_IDS.care,       name: "care",       label: "Care",       description: "Genuine concern for the customer experience",   customer_language: "Made me feel valued",         sort_order: 2, created_at: now, updated_at: now },
        { id: QUALITY_IDS.delivery,   name: "delivery",   label: "Delivery",   description: "Reliability and follow-through on promises",    customer_language: "Did exactly what they promised", sort_order: 3, created_at: now, updated_at: now },
        { id: QUALITY_IDS.initiative, name: "initiative", label: "Initiative", description: "Proactive behavior beyond expectations",        customer_language: "Went beyond what I asked",    sort_order: 4, created_at: now, updated_at: now },
        { id: QUALITY_IDS.trust,      name: "trust",      label: "Trust",      description: "Reliability and integrity that earns repeat business", customer_language: "I'd come back to this person", sort_order: 5, created_at: now, updated_at: now },
      ]);
    }
  }

  return {
    users: {
      admin:      { id: USER_IDS.admin,      email: "admin@test.local" },
      individual: { id: USER_IDS.individual, email: "individual@test.local", profileSlug: PRIMARY_PROFILE_SLUG },
      employer:   { id: USER_IDS.employer,   email: "employer@test.local" },
      recruiter:  { id: USER_IDS.recruiter,  email: "recruiter@test.local" },
    },
    profiles: {
      primary:   { id: PROFILE_IDS.primary,   slug: PRIMARY_PROFILE_SLUG },
      secondary: { id: PROFILE_IDS.secondary, slug: SECONDARY_PROFILE_SLUG },
    },
    org: { id: ORG_ID, slug: ORG_SLUG },
  };
}
