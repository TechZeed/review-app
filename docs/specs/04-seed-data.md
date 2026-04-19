# Spec 04: Seed Data

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14 (amended 2026-04-19 — seed-password wiring made real + no-fallback)
**Status:** Implemented
**Pattern:** Umzug migration-style seeds (following iepapp pattern)

---

## 1. Overview

This spec defines the seed data strategy for the review-app. Seed data provides a realistic, deterministic demo environment for development, QA, and investor demos. The seed system follows the iepapp pattern: a `seed-config.json` file for deterministic core data combined with `@faker-js/faker` for supplementary random data, executed via Umzug migration-style seed scripts.

### Design Principles

- **Deterministic core data:** All users, organizations, profiles, and review distributions are defined in `seed-config.json`. Re-running seeds produces the same logical structure.
- **Realistic distributions:** Review counts, quality pick ratios, media types, and timestamps reflect real-world patterns -- not uniform distributions.
- **FK-safe ordering:** Seed inserts respect foreign key constraints. Teardown deletes in reverse FK order.
- **Idempotent:** Seeds check for existing data before inserting. Running seeds twice does not duplicate data.
- **Portable credentials:** A single `DEFAULT_SEED_PASSWORD` env var is bcrypt-hashed into every seeded user's `password_hash`, with `provider='internal'` set so the email+password login path (spec 16) accepts them. **No fallback** — the seed throws if the env var is unset. Required in `.env`, `.env.dev`, `.env.test`. Consumed by the regression suite (spec 24).

---

## 2. File Structure

```
apps/api/src/db/seeds/
  seed-config.json                    # Deterministic core data
  20260414-0001-demo-data.ts          # Main seed script (Umzug migration)
```

---

## 3. seed-config.json

```json
{
  "users": [
    {
      "email": "ramesh@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "PRO",
      "status": "active",
      "display_name": "Ramesh Kumar",
      "phone": "+6591234001",
      "industry": "auto_sales",
      "bio": "Senior Sales Consultant with 8 years of experience helping families find their perfect vehicle."
    },
    {
      "email": "priya@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "FREE",
      "status": "active",
      "display_name": "Priya Sharma",
      "phone": "+6591234002",
      "industry": "hospitality",
      "bio": "Guest Relations Specialist passionate about creating memorable stays."
    },
    {
      "email": "david@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "FREE",
      "status": "active",
      "display_name": "David Chen",
      "phone": "+6591234003",
      "industry": "banking",
      "bio": "Relationship Manager dedicated to helping clients achieve their financial goals."
    },
    {
      "email": "sarah@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "FREE",
      "status": "active",
      "display_name": "Sarah Williams",
      "phone": "+6591234004",
      "industry": "healthcare",
      "bio": "Registered Nurse committed to compassionate patient care."
    },
    {
      "email": "ahmed@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "FREE",
      "status": "active",
      "display_name": "Ahmed Hassan",
      "phone": "+6591234005",
      "industry": "retail",
      "bio": "Retail Associate who believes every customer deserves personal attention."
    },
    {
      "email": "lisa@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "FREE",
      "status": "active",
      "display_name": "Lisa Tan",
      "phone": "+6591234006",
      "industry": "food_and_beverage",
      "bio": "Service professional who turns meals into experiences."
    },
    {
      "email": "james@reviewapp.demo",
      "role": "EMPLOYER",
      "tier": "EMPLOYER_DASHBOARD",
      "status": "active",
      "display_name": "James Wong",
      "phone": "+6591234007",
      "industry": "auto_sales",
      "bio": "General Manager at ABC Auto Dealership."
    },
    {
      "email": "meiling@reviewapp.demo",
      "role": "EMPLOYER",
      "tier": "EMPLOYER_DASHBOARD",
      "status": "active",
      "display_name": "Mei Ling",
      "phone": "+6591234008",
      "industry": "hospitality",
      "bio": "Operations Manager at Grand Hotel Singapore."
    },
    {
      "email": "rachel@reviewapp.demo",
      "role": "RECRUITER",
      "tier": "RECRUITER_ACCESS",
      "status": "active",
      "display_name": "Rachel Green",
      "phone": "+6591234009",
      "industry": "staffing",
      "bio": "Senior Recruiter at TalentFirst Staffing, specializing in frontline talent."
    },
    {
      "email": "mark@reviewapp.demo",
      "role": "RECRUITER",
      "tier": "RECRUITER_ACCESS",
      "status": "active",
      "display_name": "Mark Johnson",
      "phone": "+6591234010",
      "industry": "staffing",
      "bio": "Recruitment Manager at PeopleConnect HR."
    },
    {
      "email": "admin@reviewapp.demo",
      "role": "ADMIN",
      "tier": "ADMIN",
      "status": "active",
      "display_name": "Demo Admin",
      "phone": "+6591234011",
      "industry": null,
      "bio": null
    },
    {
      "email": "ramesh.pro@reviewapp.demo",
      "role": "INDIVIDUAL",
      "tier": "PRO",
      "status": "active",
      "display_name": "Ramesh Kumar (Pro)",
      "phone": "+6591234012",
      "industry": "auto_sales",
      "bio": "Senior Sales Consultant -- Pro tier account for demo purposes. (Alias of Ramesh Kumar.)",
      "_note": "This is the same persona as ramesh@reviewapp.demo but on the Pro tier for demonstrating Pro features. In production, Ramesh would have a single account upgraded to Pro."
    }
  ],

  "organizations": [
    {
      "slug": "abc-auto-dealership",
      "name": "ABC Auto Dealership",
      "industry": "auto_sales",
      "city": "Singapore",
      "country": "SG",
      "employee_count_tier": "25-100",
      "description": "Trusted multi-brand auto dealership serving Singapore since 2005."
    },
    {
      "slug": "grand-hotel-singapore",
      "name": "Grand Hotel Singapore",
      "industry": "hospitality",
      "city": "Singapore",
      "country": "SG",
      "employee_count_tier": "100+",
      "description": "Five-star hotel in the heart of Orchard Road."
    },
    {
      "slug": "dbs-bank",
      "name": "DBS Bank",
      "industry": "banking",
      "city": "Singapore",
      "country": "SG",
      "employee_count_tier": "100+",
      "description": "Southeast Asia's largest bank by assets."
    },
    {
      "slug": "mount-elizabeth-hospital",
      "name": "Mount Elizabeth Hospital",
      "industry": "healthcare",
      "city": "Singapore",
      "country": "SG",
      "employee_count_tier": "100+",
      "description": "Premier private hospital providing specialist medical care."
    },
    {
      "slug": "tangs-department-store",
      "name": "Tangs Department Store",
      "industry": "retail",
      "city": "Singapore",
      "country": "SG",
      "employee_count_tier": "100+",
      "description": "Iconic Singapore department store since 1932."
    },
    {
      "slug": "din-tai-fung",
      "name": "Din Tai Fung",
      "industry": "food_and_beverage",
      "city": "Singapore",
      "country": "SG",
      "employee_count_tier": "25-100",
      "description": "World-renowned dumpling restaurant chain."
    }
  ],

  "profiles": [
    {
      "user_email": "ramesh@reviewapp.demo",
      "slug": "ramesh-kumar",
      "role_title": "Senior Sales Consultant",
      "current_org_slug": "abc-auto-dealership",
      "past_org_slugs": ["dbs-bank", "tangs-department-store"],
      "review_count": 150,
      "verifiable_reference_count": 30,
      "profile_maturity": "veteran",
      "quality_distribution": {
        "expertise": 0.35,
        "trust": 0.25,
        "delivery": 0.20,
        "care": 0.12,
        "initiative": 0.08
      },
      "signature_strengths": ["expertise", "trust"]
    },
    {
      "user_email": "priya@reviewapp.demo",
      "slug": "priya-sharma",
      "role_title": "Guest Relations Specialist",
      "current_org_slug": "grand-hotel-singapore",
      "past_org_slugs": [],
      "review_count": 80,
      "verifiable_reference_count": 16,
      "profile_maturity": "established",
      "quality_distribution": {
        "care": 0.30,
        "initiative": 0.28,
        "trust": 0.20,
        "delivery": 0.12,
        "expertise": 0.10
      },
      "signature_strengths": ["care"]
    },
    {
      "user_email": "david@reviewapp.demo",
      "slug": "david-chen",
      "role_title": "Relationship Manager",
      "current_org_slug": "dbs-bank",
      "past_org_slugs": [],
      "review_count": 45,
      "verifiable_reference_count": 9,
      "profile_maturity": "growing",
      "quality_distribution": {
        "expertise": 0.32,
        "delivery": 0.28,
        "trust": 0.22,
        "care": 0.10,
        "initiative": 0.08
      },
      "signature_strengths": []
    },
    {
      "user_email": "sarah@reviewapp.demo",
      "slug": "sarah-williams",
      "role_title": "Registered Nurse",
      "current_org_slug": "mount-elizabeth-hospital",
      "past_org_slugs": [],
      "review_count": 200,
      "verifiable_reference_count": 40,
      "profile_maturity": "veteran",
      "quality_distribution": {
        "care": 0.35,
        "trust": 0.30,
        "expertise": 0.18,
        "initiative": 0.10,
        "delivery": 0.07
      },
      "signature_strengths": ["care", "trust"]
    },
    {
      "user_email": "ahmed@reviewapp.demo",
      "slug": "ahmed-hassan",
      "role_title": "Retail Associate",
      "current_org_slug": "tangs-department-store",
      "past_org_slugs": [],
      "review_count": 12,
      "verifiable_reference_count": 2,
      "profile_maturity": "new",
      "quality_distribution": {
        "expertise": 0.20,
        "care": 0.20,
        "delivery": 0.20,
        "initiative": 0.20,
        "trust": 0.20
      },
      "signature_strengths": []
    },
    {
      "user_email": "lisa@reviewapp.demo",
      "slug": "lisa-tan",
      "role_title": "Senior Server",
      "current_org_slug": "din-tai-fung",
      "past_org_slugs": [],
      "review_count": 30,
      "verifiable_reference_count": 6,
      "profile_maturity": "growing",
      "quality_distribution": {
        "initiative": 0.30,
        "care": 0.28,
        "delivery": 0.20,
        "expertise": 0.12,
        "trust": 0.10
      },
      "signature_strengths": []
    }
  ],

  "subscriptions": [
    {
      "user_email": "ramesh@reviewapp.demo",
      "plan": "PRO_INDIVIDUAL",
      "price_monthly_usd": 5,
      "status": "active",
      "started_months_ago": 4
    },
    {
      "user_email": "james@reviewapp.demo",
      "plan": "EMPLOYER_DASHBOARD",
      "price_monthly_usd": 100,
      "status": "active",
      "started_months_ago": 3,
      "org_slug": "abc-auto-dealership"
    },
    {
      "user_email": "rachel@reviewapp.demo",
      "plan": "RECRUITER_ACCESS",
      "price_monthly_usd": 500,
      "status": "active",
      "started_months_ago": 2
    }
  ],

  "review_templates": {
    "text_samples": {
      "auto_sales": [
        "Ramesh found us the perfect car within our budget",
        "He knew every detail about the hybrid models we were comparing",
        "Very patient with all our questions about financing options",
        "Ramesh followed up the next day to make sure we were happy",
        "Helped us trade in our old car and got us a fair price",
        "No pressure at all -- he let us take our time deciding",
        "He remembered our test drive preferences from the previous visit",
        "Found a promotion we didn't even know about and saved us $3,000",
        "The paperwork was ready before we even arrived to pick up the car",
        "Recommended the extended warranty and explained exactly why it made sense for us"
      ],
      "hospitality": [
        "Priya remembered our anniversary and arranged flowers in the room",
        "She recommended the perfect restaurant for our family dinner",
        "Went out of her way to get us early check-in after a long flight",
        "Noticed my daughter was upset and brought her a stuffed toy from the gift shop",
        "Arranged a surprise birthday cake at the pool bar",
        "She speaks four languages and helped us communicate with the spa staff",
        "Remembered our room temperature preference from our last stay",
        "Called ahead to the restaurant to let them know about our allergies",
        "Organized a last-minute city tour when our original plans fell through",
        "Left a handwritten welcome note with local tips -- such a personal touch"
      ],
      "banking": [
        "David explained the mortgage options clearly without rushing us",
        "He flagged a better interest rate before we even asked",
        "Helped restructure our savings plan after the market downturn",
        "Very transparent about fees -- no hidden surprises",
        "Followed up personally when our application was approved",
        "He understood our financial anxiety and was very reassuring",
        "Processed our business loan ahead of schedule",
        "Proactively called us when a new product matched our investment profile"
      ],
      "healthcare": [
        "Sarah made me feel safe before a procedure I was terrified of",
        "She explained every step of the process so I always knew what was happening",
        "Checked on me after her shift ended -- that's above and beyond",
        "Noticed something on my chart that the previous shift missed",
        "Very gentle with my elderly mother during the blood draw",
        "She advocated for a pain management change that made all the difference",
        "Remembered my name and my situation even after a week away",
        "Stayed calm and reassuring during a scary moment in recovery",
        "She took time to explain the medication schedule to my family",
        "Coordinated with the specialist so I didn't have to repeat my history"
      ],
      "retail": [
        "Ahmed helped me find the perfect gift when I had no idea what to get",
        "Very knowledgeable about fabrics and helped me pick the right material",
        "Didn't push expensive items -- recommended what actually suited my needs",
        "He was patient while I tried on what felt like a hundred things",
        "Found an item in another store's inventory and had it shipped to me"
      ],
      "food_and_beverage": [
        "Lisa noticed our toddler was getting restless and brought crayons immediately",
        "Recommended the seasonal special and it was the best dish of the night",
        "She remembered our table's allergies without us having to repeat them",
        "Pacing of the courses was perfect -- she checked in at just the right moments",
        "Arranged a small birthday surprise without us even mentioning it",
        "Suggested a wine pairing that elevated the whole meal",
        "She handled a mistake with our order gracefully and made it right instantly"
      ]
    },

    "voice_placeholder_urls": [
      "gs://review-app-media/seeds/voice/voice-review-001.webm",
      "gs://review-app-media/seeds/voice/voice-review-002.webm",
      "gs://review-app-media/seeds/voice/voice-review-003.webm",
      "gs://review-app-media/seeds/voice/voice-review-004.webm",
      "gs://review-app-media/seeds/voice/voice-review-005.webm"
    ],

    "video_placeholder_urls": [
      "gs://review-app-media/seeds/video/video-review-001.mp4",
      "gs://review-app-media/seeds/video/video-review-002.mp4",
      "gs://review-app-media/seeds/video/video-review-003.mp4"
    ]
  },

  "review_media_distribution": {
    "quality_picks_only": 0.40,
    "text": 0.40,
    "voice": 0.15,
    "video": 0.05
  },

  "verification_levels": {
    "basic_review": 0.10,
    "verified_review": 0.50,
    "verified_interaction": 0.30,
    "verified_testimonial": 0.10
  },

  "verifiable_reference_opt_in_rate": 0.20
}
```

---

## 4. Quality Pick Distribution Algorithm

Each profile has a defined quality distribution in `seed-config.json`. When generating reviews, the seed script uses these distributions to determine which qualities each review selects.

### Distribution Table

| Profile | Expertise | Care | Delivery | Initiative | Trust | Dominant Qualities |
|---------|-----------|------|----------|------------|-------|--------------------|
| **Ramesh** (auto sales, 150 reviews) | 35% | 12% | 20% | 8% | 25% | Expertise, Trust |
| **Priya** (hospitality, 80 reviews) | 10% | 30% | 12% | 28% | 20% | Care, Initiative |
| **David** (banking, 45 reviews) | 32% | 10% | 28% | 8% | 22% | Expertise, Delivery |
| **Sarah** (healthcare, 200 reviews) | 18% | 35% | 7% | 10% | 30% | Care, Trust |
| **Ahmed** (retail, 12 reviews) | 20% | 20% | 20% | 20% | 20% | (balanced) |
| **Lisa** (F&B, 30 reviews) | 12% | 28% | 20% | 30% | 10% | Initiative, Care |

### Algorithm

For each review for a given profile:

1. **Determine number of quality picks:** Weighted random -- 60% chance of 1 pick, 40% chance of 2 picks. This produces an average of ~1.4 picks per review (matching the 1.4-1.7 target from PRD 02).
2. **Select qualities using weighted distribution:** Use the profile's `quality_distribution` weights. For a 2-pick review, select the first quality by weighted random, then select the second from the remaining four qualities (re-normalized weights excluding the first pick).
3. **Insert `QualityPick` records:** One per selected quality, linked to the review and profile.

### Expected Aggregate Outputs

After seeding, the aggregate quality scores should approximately match the distribution table. Small variance from faker randomness is expected and acceptable.

| Profile | Total Reviews | Expected Quality Picks | Signature Strengths |
|---------|--------------|----------------------|---------------------|
| Ramesh | 150 | ~210 picks | Expertise (sig), Trust |
| Priya | 80 | ~112 picks | Care (sig) |
| David | 45 | ~63 picks | None (profile too young at 45 reviews; needs 50+ for sig strength) |
| Sarah | 200 | ~280 picks | Care (sig), Trust (sig) |
| Ahmed | 12 | ~17 picks | None (new profile) |
| Lisa | 30 | ~42 picks | None (growing profile) |

---

## 5. Review Generation Strategy

### 5.1 Timestamp Distribution

Reviews are spread over the last 6 months. The distribution is not uniform -- it follows a realistic growth curve:

| Period | % of Reviews | Rationale |
|--------|-------------|-----------|
| Month 1 (oldest) | 8% | Early adoption, few customers know about the QR code |
| Month 2 | 12% | Growing awareness |
| Month 3 | 16% | Word of mouth kicks in |
| Month 4 | 20% | Steady state |
| Month 5 | 22% | Momentum building |
| Month 6 (most recent) | 22% | Current month |

Within each month, timestamps are randomly distributed across business hours (8am-10pm local time, weighted toward evenings and weekends for consumer-facing roles).

### 5.2 Media Type Assignment

For each review, determine media type using the `review_media_distribution` weights:

| Media Type | Probability | Behavior |
|------------|-------------|----------|
| Quality picks only | 40% | No media attached. Review consists of quality taps + thumbs up only. |
| Text | 40% | Select a random text sample from the profile's industry in `review_templates.text_samples`. |
| Voice | 15% | Attach a placeholder voice URL from `voice_placeholder_urls`. Cycle through available URLs. |
| Video | 5% | Attach a placeholder video URL from `video_placeholder_urls`. Cycle through available URLs. |

### 5.3 Verification Level Assignment

Each review receives a verification level (fraud score tier) using the `verification_levels` weights:

| Level | Probability | Fraud Score Range |
|-------|-------------|-------------------|
| Basic Review | 10% | 30 (QR scan only) |
| Verified Review | 50% | 70 (QR + OTP + time window) |
| Verified Interaction | 30% | 90 (QR + OTP + time + AI clear) |
| Verified Testimonial | 10% | 100 (all 5 layers + video/voice) |

**Constraint:** "Verified Testimonial" level is only assigned to reviews with voice or video media. If a quality-picks-only or text review randomly draws "Verified Testimonial," downgrade it to "Verified Interaction."

### 5.4 Verifiable References

20% of reviews have the customer opt-in flag set to `true`. These reviews receive the "Verifiable" badge.

Per-profile verifiable reference counts:

| Profile | Total Reviews | Verifiable References | % Opt-In |
|---------|--------------|----------------------|----------|
| Ramesh | 150 | 30 | 20% |
| Priya | 80 | 16 | 20% |
| David | 45 | 9 | 20% |
| Sarah | 200 | 40 | 20% |
| Ahmed | 12 | 2 | ~17% |
| Lisa | 30 | 6 | 20% |
| **Total** | **517** | **103** | **~20%** |

---

## 6. Profile-Organization Associations

Each individual is tagged to their current organization. Ramesh additionally has two past organization associations to demonstrate the portability feature.

| Individual | Current Org | Past Orgs | Notes |
|------------|-------------|-----------|-------|
| Ramesh Kumar | ABC Auto Dealership | DBS Bank, Tangs Department Store | Shows career portability -- reviews from all three orgs visible on profile |
| Priya Sharma | Grand Hotel Singapore | -- | |
| David Chen | DBS Bank | -- | |
| Sarah Williams | Mount Elizabeth Hospital | -- | |
| Ahmed Hassan | Tangs Department Store | -- | |
| Lisa Tan | Din Tai Fung | -- | |

### Past Org Association Data

For Ramesh's past orgs, the seed creates `profile_organizations` records with `status: 'past'` and `untagged_at` timestamps:

- DBS Bank: tagged 3 years ago, untagged 18 months ago
- Tangs Department Store: tagged 18 months ago, untagged 8 months ago
- ABC Auto Dealership: tagged 8 months ago, currently active

Reviews are distributed across these org associations proportionally:
- DBS Bank period: ~20% of Ramesh's reviews (30 reviews)
- Tangs period: ~25% of Ramesh's reviews (38 reviews)
- ABC Auto period: ~55% of Ramesh's reviews (82 reviews)

---

## 7. Subscriptions

| User | Plan | Price | Status | Started |
|------|------|-------|--------|---------|
| Ramesh Kumar | PRO_INDIVIDUAL | $5/month | active | 4 months ago |
| James Wong | EMPLOYER_DASHBOARD | $100/month | active | 3 months ago |
| Rachel Green | RECRUITER_ACCESS | $500/month | active | 2 months ago |
| All others | FREE | $0 | -- | At registration |

Subscription records include:
- `plan`: enum (FREE, PRO_INDIVIDUAL, EMPLOYER_DASHBOARD, RECRUITER_ACCESS)
- `price_monthly_usd`: integer
- `status`: enum (active, cancelled, expired)
- `current_period_start`: timestamp
- `current_period_end`: timestamp (start + 30 days)
- `created_at`: timestamp

---

## 8. Seed Script Structure

### File: `20260414-0001-demo-data.ts`

```typescript
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import type { Migration } from "../umzug.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load seed configuration
const configPath = join(__dirname, "seed-config.json");
const seedConfig = JSON.parse(readFileSync(configPath, "utf-8"));

// --- Types ---

interface UserConfig {
  email: string;
  role: string;
  tier: string;
  status: string;
  display_name: string;
  phone: string;
  industry: string | null;
  bio: string | null;
}

interface OrgConfig {
  slug: string;
  name: string;
  industry: string;
  city: string;
  country: string;
  employee_count_tier: string;
  description: string;
}

interface ProfileConfig {
  user_email: string;
  slug: string;
  role_title: string;
  current_org_slug: string;
  past_org_slugs: string[];
  review_count: number;
  verifiable_reference_count: number;
  profile_maturity: string;
  quality_distribution: Record<string, number>;
  signature_strengths: string[];
}

interface SubscriptionConfig {
  user_email: string;
  plan: string;
  price_monthly_usd: number;
  status: string;
  started_months_ago: number;
  org_slug?: string;
}

type Quality = "expertise" | "care" | "delivery" | "initiative" | "trust";
const QUALITIES: Quality[] = ["expertise", "care", "delivery", "initiative", "trust"];

// --- Helpers ---

function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickQualities(distribution: Record<string, number>): Quality[] {
  const numPicks = Math.random() < 0.6 ? 1 : 2;
  const qualities = QUALITIES.slice();
  const weights = qualities.map((q) => distribution[q] || 0);

  const first = weightedRandom(qualities, weights);
  if (numPicks === 1) return [first];

  const remaining = qualities.filter((q) => q !== first);
  const remainingWeights = remaining.map((q) => distribution[q] || 0);
  const second = weightedRandom(remaining, remainingWeights);
  return [first, second];
}

function generateReviewTimestamp(monthIndex: number): Date {
  // monthIndex 0 = oldest (6 months ago), 5 = most recent
  const now = new Date();
  const monthsAgo = 5 - monthIndex;
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsAgo - 1);
  const end = new Date(now);
  end.setMonth(end.getMonth() - monthsAgo);

  const timestamp = faker.date.between({ from: start, to: end });
  // Weight toward business hours (8am-10pm)
  timestamp.setHours(faker.number.int({ min: 8, max: 22 }));
  timestamp.setMinutes(faker.number.int({ min: 0, max: 59 }));
  return timestamp;
}

const MONTH_DISTRIBUTION = [0.08, 0.12, 0.16, 0.20, 0.22, 0.22];

function assignReviewsToMonths(totalReviews: number): number[] {
  const counts = MONTH_DISTRIBUTION.map((pct) => Math.round(totalReviews * pct));
  // Adjust rounding errors
  const diff = totalReviews - counts.reduce((s, c) => s + c, 0);
  counts[counts.length - 1] += diff;
  return counts;
}

// --- Main seed ---

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const password = process.env.DEFAULT_SEED_PASSWORD;
  if (!password) {
    throw new Error("DEFAULT_SEED_PASSWORD must be set — required to seed demo user passwords.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  // Idempotency check
  const existingUsers = await queryInterface.select(null, "users", {});
  if (existingUsers && existingUsers.length > 0) {
    console.log("⚠️  Users already exist in database. Skipping seed.");
    console.log("   Run 'seed:down' first if you want to reset the data.");
    return;
  }

  console.log("🌱 Starting review-app demo data seeding...\n");

  // -------------------------------------------------------
  // 1. USERS
  // -------------------------------------------------------
  const users = seedConfig.users as UserConfig[];
  const userIds: Record<string, string> = {};

  const usersData = users.map((user) => {
    const id = faker.string.uuid();
    userIds[user.email] = id;
    return {
      id,
      email: user.email,
      password_hash: passwordHash,
      display_name: user.display_name,
      phone_hash: faker.string.alphanumeric(64), // simulated hash
      role: user.role,
      tier: user.tier,
      status: user.status,
      industry: user.industry,
      bio: user.bio,
      created_at: now,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("users", usersData);
  console.log(`👤 Created ${usersData.length} users`);

  // -------------------------------------------------------
  // 2. ORGANIZATIONS
  // -------------------------------------------------------
  const orgs = seedConfig.organizations as OrgConfig[];
  const orgIds: Record<string, string> = {};

  const orgsData = orgs.map((org) => {
    const id = faker.string.uuid();
    orgIds[org.slug] = id;
    return {
      id,
      slug: org.slug,
      name: org.name,
      industry: org.industry,
      city: org.city,
      country: org.country,
      employee_count_tier: org.employee_count_tier,
      description: org.description,
      created_at: now,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("organizations", orgsData);
  console.log(`🏢 Created ${orgsData.length} organizations`);

  // -------------------------------------------------------
  // 3. PROFILES
  // -------------------------------------------------------
  const profiles = seedConfig.profiles as ProfileConfig[];
  const profileIds: Record<string, string> = {};

  const profilesData = profiles.map((profile) => {
    const id = faker.string.uuid();
    profileIds[profile.user_email] = id;
    return {
      id,
      user_id: userIds[profile.user_email],
      slug: profile.slug,
      role_title: profile.role_title,
      profile_maturity: profile.profile_maturity,
      visibility: "public", // demo profiles are public
      created_at: now,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("profiles", profilesData);
  console.log(`📋 Created ${profilesData.length} profiles`);

  // -------------------------------------------------------
  // 4. PROFILE-ORGANIZATION ASSOCIATIONS
  // -------------------------------------------------------
  const profileOrgsData: any[] = [];

  for (const profile of profiles) {
    const profileId = profileIds[profile.user_email];

    // Current org
    profileOrgsData.push({
      id: faker.string.uuid(),
      profile_id: profileId,
      organization_id: orgIds[profile.current_org_slug],
      status: "active",
      tagged_at: faker.date.past({ years: 1 }),
      untagged_at: null,
      created_at: now,
      updated_at: now,
    });

    // Past orgs (Ramesh)
    for (const pastSlug of profile.past_org_slugs) {
      const taggedAt = faker.date.past({ years: 3 });
      const untaggedAt = faker.date.between({ from: taggedAt, to: now });
      profileOrgsData.push({
        id: faker.string.uuid(),
        profile_id: profileId,
        organization_id: orgIds[pastSlug],
        status: "past",
        tagged_at: taggedAt,
        untagged_at: untaggedAt,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await queryInterface.bulkInsert("profile_organizations", profileOrgsData);
  console.log(`🔗 Created ${profileOrgsData.length} profile-org associations`);

  // -------------------------------------------------------
  // 5. REVIEWS + QUALITY PICKS + REVIEW MEDIA
  // -------------------------------------------------------
  const reviewsData: any[] = [];
  const qualityPicksData: any[] = [];
  const reviewMediaData: any[] = [];
  const verifiableRefsData: any[] = [];

  const mediaDistribution = seedConfig.review_media_distribution;
  const verificationLevels = seedConfig.verification_levels;
  const textSamples = seedConfig.review_templates.text_samples;
  const voiceUrls = seedConfig.review_templates.voice_placeholder_urls;
  const videoUrls = seedConfig.review_templates.video_placeholder_urls;

  let totalReviews = 0;
  let totalPicks = 0;
  let totalMedia = 0;
  let totalVerifiable = 0;

  for (const profile of profiles) {
    const profileId = profileIds[profile.user_email];
    const monthCounts = assignReviewsToMonths(profile.review_count);
    let verifiableRemaining = profile.verifiable_reference_count;
    let reviewIndex = 0;

    // Determine industry for text samples
    const userConfig = users.find((u) => u.email === profile.user_email);
    const industry = userConfig?.industry || "auto_sales";
    const industrySamples = textSamples[industry] || textSamples["auto_sales"];

    for (let month = 0; month < 6; month++) {
      const count = monthCounts[month];
      for (let i = 0; i < count; i++) {
        const reviewId = faker.string.uuid();
        const timestamp = generateReviewTimestamp(month);

        // Determine media type
        const mediaRoll = Math.random();
        let mediaType: "none" | "text" | "voice" | "video";
        if (mediaRoll < mediaDistribution.quality_picks_only) {
          mediaType = "none";
        } else if (mediaRoll < mediaDistribution.quality_picks_only + mediaDistribution.text) {
          mediaType = "text";
        } else if (mediaRoll < mediaDistribution.quality_picks_only + mediaDistribution.text + mediaDistribution.voice) {
          mediaType = "voice";
        } else {
          mediaType = "video";
        }

        // Determine verification level
        const verRoll = Math.random();
        let verificationLevel: string;
        let fraudScore: number;
        if (verRoll < verificationLevels.basic_review) {
          verificationLevel = "basic_review";
          fraudScore = 30;
        } else if (verRoll < verificationLevels.basic_review + verificationLevels.verified_review) {
          verificationLevel = "verified_review";
          fraudScore = 70;
        } else if (verRoll < verificationLevels.basic_review + verificationLevels.verified_review + verificationLevels.verified_interaction) {
          verificationLevel = "verified_interaction";
          fraudScore = 90;
        } else {
          verificationLevel = "verified_testimonial";
          fraudScore = 100;
        }

        // Constraint: verified_testimonial requires voice or video
        if (verificationLevel === "verified_testimonial" && mediaType !== "voice" && mediaType !== "video") {
          verificationLevel = "verified_interaction";
          fraudScore = 90;
        }

        // Determine verifiable reference opt-in
        const isVerifiable = verifiableRemaining > 0 && reviewIndex < profile.review_count;
        const shouldOptIn = isVerifiable && (verifiableRemaining / (profile.review_count - reviewIndex)) > Math.random();

        if (shouldOptIn) {
          verifiableRemaining--;
        }

        // Create review
        reviewsData.push({
          id: reviewId,
          profile_id: profileId,
          reviewer_phone_hash: faker.string.alphanumeric(64),
          reviewer_device_hash: faker.string.alphanumeric(32),
          verification_level: verificationLevel,
          fraud_score: fraudScore,
          is_verifiable: shouldOptIn,
          thumbs_up: true,
          created_at: timestamp,
          updated_at: timestamp,
        });

        // Create quality picks
        const picks = pickQualities(profile.quality_distribution);
        for (const quality of picks) {
          qualityPicksData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            profile_id: profileId,
            quality: quality,
            created_at: timestamp,
          });
          totalPicks++;
        }

        // Create media
        if (mediaType === "text") {
          const textContent = industrySamples[reviewIndex % industrySamples.length];
          reviewMediaData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            media_type: "text",
            content: textContent,
            media_url: null,
            duration_seconds: null,
            created_at: timestamp,
          });
          totalMedia++;
        } else if (mediaType === "voice") {
          reviewMediaData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            media_type: "voice",
            content: null,
            media_url: voiceUrls[reviewIndex % voiceUrls.length],
            duration_seconds: faker.number.int({ min: 5, max: 15 }),
            created_at: timestamp,
          });
          totalMedia++;
        } else if (mediaType === "video") {
          reviewMediaData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            media_type: "video",
            content: null,
            media_url: videoUrls[reviewIndex % videoUrls.length],
            duration_seconds: faker.number.int({ min: 10, max: 30 }),
            created_at: timestamp,
          });
          totalMedia++;
        }

        // Verifiable reference record
        if (shouldOptIn) {
          verifiableRefsData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            profile_id: profileId,
            customer_phone_hash: faker.string.alphanumeric(64),
            consent_granted_at: timestamp,
            consent_withdrawn_at: null,
            status: "active",
            created_at: timestamp,
            updated_at: timestamp,
          });
          totalVerifiable++;
        }

        reviewIndex++;
        totalReviews++;
      }
    }
  }

  // Bulk inserts
  await queryInterface.bulkInsert("reviews", reviewsData);
  console.log(`⭐ Created ${totalReviews} reviews`);

  await queryInterface.bulkInsert("quality_picks", qualityPicksData);
  console.log(`🎯 Created ${totalPicks} quality picks`);

  if (reviewMediaData.length > 0) {
    await queryInterface.bulkInsert("review_media", reviewMediaData);
    console.log(`📸 Created ${totalMedia} review media records`);
  }

  if (verifiableRefsData.length > 0) {
    await queryInterface.bulkInsert("verifiable_references", verifiableRefsData);
    console.log(`✅ Created ${totalVerifiable} verifiable references`);
  }

  // -------------------------------------------------------
  // 6. QUALITY AGGREGATES
  // -------------------------------------------------------
  const aggregatesData: any[] = [];

  for (const profile of profiles) {
    const profileId = profileIds[profile.user_email];
    for (const quality of QUALITIES) {
      const pct = profile.quality_distribution[quality];
      const totalPicks = Math.round(profile.review_count * 1.4 * pct);
      const isSignature = profile.signature_strengths.includes(quality);

      aggregatesData.push({
        id: faker.string.uuid(),
        profile_id: profileId,
        quality: quality,
        total_picks: totalPicks,
        weighted_picks: totalPicks * 1.0, // no recency weighting for seed data
        percentage: pct * 100,
        is_signature_strength: isSignature,
        last_calculated_at: now,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await queryInterface.bulkInsert("quality_aggregates", aggregatesData);
  console.log(`📊 Created ${aggregatesData.length} quality aggregates`);

  // -------------------------------------------------------
  // 7. SUBSCRIPTIONS
  // -------------------------------------------------------
  const subs = seedConfig.subscriptions as SubscriptionConfig[];
  const subsData = subs.map((sub) => {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - sub.started_months_ago);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    return {
      id: faker.string.uuid(),
      user_id: userIds[sub.user_email],
      organization_id: sub.org_slug ? orgIds[sub.org_slug] : null,
      plan: sub.plan,
      price_monthly_usd: sub.price_monthly_usd,
      status: sub.status,
      current_period_start: startDate,
      current_period_end: endDate,
      created_at: startDate,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("subscriptions", subsData);
  console.log(`💳 Created ${subsData.length} subscriptions`);

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  console.log("\n📝 Demo user credentials:");
  console.log("-------------------------------------------");
  users.forEach((user) => {
    console.log(
      `${user.role.padEnd(12)} ${user.tier.padEnd(20)} ${user.email.padEnd(35)} / ${password}`
    );
  });
  console.log("-------------------------------------------");
  console.log(`\n🌱 Seeding complete!`);
  console.log(`   👤 ${usersData.length} users`);
  console.log(`   🏢 ${orgsData.length} organizations`);
  console.log(`   📋 ${profilesData.length} profiles`);
  console.log(`   🔗 ${profileOrgsData.length} profile-org associations`);
  console.log(`   ⭐ ${totalReviews} reviews`);
  console.log(`   🎯 ${totalPicks} quality picks`);
  console.log(`   📸 ${totalMedia} media records`);
  console.log(`   ✅ ${totalVerifiable} verifiable references`);
  console.log(`   📊 ${aggregatesData.length} quality aggregates`);
  console.log(`   💳 ${subsData.length} subscriptions\n`);
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  console.log("🧹 Cleaning all seed data (FK-safe order)...");

  // Delete in reverse foreign key order
  await queryInterface.bulkDelete("verifiable_references", {});
  await queryInterface.bulkDelete("review_media", {});
  await queryInterface.bulkDelete("quality_picks", {});
  await queryInterface.bulkDelete("quality_aggregates", {});
  await queryInterface.bulkDelete("reviews", {});
  await queryInterface.bulkDelete("subscriptions", {});
  await queryInterface.bulkDelete("profile_organizations", {});
  await queryInterface.bulkDelete("profiles", {});
  await queryInterface.bulkDelete("organizations", {});
  await queryInterface.bulkDelete("users", {});

  console.log("✅ All seed data deleted successfully!");
};
```

---

## 9. Database Tables Seeded

The seed script populates the following tables in FK-safe insertion order:

| Order | Table | Records | Source |
|-------|-------|---------|--------|
| 1 | `users` | 12 | seed-config.json |
| 2 | `organizations` | 6 | seed-config.json |
| 3 | `profiles` | 6 | seed-config.json |
| 4 | `profile_organizations` | 8 (6 current + 2 past) | seed-config.json + generated |
| 5 | `reviews` | 517 | generated from profile configs |
| 6 | `quality_picks` | ~724 (~1.4 per review) | generated using distribution algorithm |
| 7 | `review_media` | ~310 (60% of reviews have media) | generated with text samples + placeholder URLs |
| 8 | `verifiable_references` | ~103 (20% of reviews) | generated per profile config |
| 9 | `quality_aggregates` | 30 (6 profiles x 5 qualities) | computed from profile configs |
| 10 | `subscriptions` | 3 | seed-config.json |

Teardown (`down`) deletes in reverse order (10 -> 1).

---

## 10. Running the Seeds

### Commands

```bash
# Run seeds (up)
npm run seed:up

# Teardown seeds (down)
npm run seed:down

# Reset (down + up)
npm run seed:reset
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_SEED_PASSWORD` | *(no default — required)* | Plaintext password bcrypt-hashed into every demo user's `password_hash`. Seed throws if unset. Set in `.env`, `.env.dev`, `.env.test`. |
| `DATABASE_URL` | -- | PostgreSQL connection string |

### Idempotency

The `up` function checks for the configured demo seed user emails (from `seed-config.json`), not all users in the database.  
If all demo users already exist, seeding is skipped.  
If only some demo users exist (partial seed), the seed fails fast and asks for cleanup before retrying.  
This lets demo data be seeded in environments that already contain real users.

---

## 11. Data Verification Checklist

After seeding, verify the following:

- [ ] 12 users exist with correct roles and tiers
- [ ] 6 organizations exist with correct industries
- [ ] 6 profiles exist, each linked to a user
- [ ] 8 profile-organization records (6 active + 2 past for Ramesh)
- [ ] 517 reviews distributed across 6 profiles with correct counts
- [ ] Quality picks follow the distribution within +/- 5% of target
- [ ] ~40% of reviews have text media, ~15% voice, ~5% video, ~40% none
- [ ] ~20% of reviews have verifiable reference opt-in
- [ ] Verified Testimonial badge only appears on reviews with voice/video media
- [ ] Ramesh has Pro subscription, James has Employer Dashboard, Rachel has Recruiter Access
- [ ] All timestamps fall within the last 6 months
- [ ] Ramesh's profile shows reviews spanning 3 different organizations
- [ ] All demo users can log in with `DEFAULT_SEED_PASSWORD` (email+password path, `provider='internal'`)
