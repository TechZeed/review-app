import { faker } from "@faker-js/faker";
import { QueryTypes } from "sequelize";
import bcrypt from "bcrypt";
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
  const now = new Date();
  const monthsAgo = 5 - monthIndex;
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsAgo - 1);
  const end = new Date(now);
  end.setMonth(end.getMonth() - monthsAgo);

  const timestamp = faker.date.between({ from: start, to: end });
  timestamp.setHours(faker.number.int({ min: 8, max: 22 }));
  timestamp.setMinutes(faker.number.int({ min: 0, max: 59 }));
  return timestamp;
}

const MONTH_DISTRIBUTION = [0.08, 0.12, 0.16, 0.20, 0.22, 0.22];

function assignReviewsToMonths(totalReviews: number): number[] {
  const counts = MONTH_DISTRIBUTION.map((pct) => Math.round(totalReviews * pct));
  const diff = totalReviews - counts.reduce((s, c) => s + c, 0);
  counts[counts.length - 1] += diff;
  return counts;
}

// --- Main seed ---

export const up: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();
  const now = new Date();
  const users = seedConfig.users as UserConfig[];

  // Idempotency check based on known demo users only.
  // This allows seeding demo data into databases that already contain real users.
  const seedEmails = users.map((user) => user.email);
  if (seedEmails.length === 0) {
    throw new Error(
      "Seed config has no users defined. Please add users to seed-config.json before running seed.",
    );
  }
  const inClause = seedEmails.map((email) => sequelize.escape(email)).join(", ");
  const existingSeedUsers = await sequelize.query<{ email: string }>(
    `SELECT email FROM users WHERE email IN (${inClause})`,
    { type: QueryTypes.SELECT },
  );

  if (existingSeedUsers.length === seedEmails.length) {
    console.log("Demo seed users already exist. Skipping seed.");
    return;
  }

  if (existingSeedUsers.length > 0) {
    throw new Error(
      `Partial demo seed detected (${existingSeedUsers.length}/${seedEmails.length} users present). ` +
      "Please clean up partial seed data before running db:seed up again.",
    );
  }

  console.log("Starting review-app demo data seeding...\n");

  // -------------------------------------------------------
  // 1. USERS
  // -------------------------------------------------------
  const userIds: Record<string, string> = {};

  // Demo users get a bcrypt-hashed password so regression tests can log in
  // via email+password. One hash shared by all demo users (seed-only).
  const seedPassword = process.env.DEFAULT_SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("DEFAULT_SEED_PASSWORD must be set — required to seed demo user passwords.");
  }
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const usersData = users.map((user) => {
    const id = faker.string.uuid();
    userIds[user.email] = id;
    // spec 25: give the six visible demo individuals deterministic avatar
    // URLs so the scan flow + public profile look polished in demos.
    // ui-avatars.com produces initial-on-coloured-circle PNGs — no API
    // key, stable per-name, avoids real-person stock photos.
    const avatarUrl =
      user.role === "INDIVIDUAL"
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
            user.display_name,
          )}&size=300&background=random`
        : null;
    return {
      id,
      firebase_uid: `demo_firebase_${user.email.replace("@", "_at_").replace(".", "_dot_")}`,
      email: user.email,
      phone: user.phone,
      display_name: user.display_name,
      role: user.role,
      status: user.status,
      avatar_url: avatarUrl,
      provider: "internal",
      password_hash: passwordHash,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("users", usersData);
  console.log(`Created ${usersData.length} users`);

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
      name: org.name,
      industry: org.industry,
      location: `${org.city}, ${org.country}`,
      logo_url: null,
      website: null,
      created_at: now,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("organizations", orgsData);
  console.log(`Created ${orgsData.length} organizations`);

  // -------------------------------------------------------
  // 3. PROFILES
  // -------------------------------------------------------
  const profiles = seedConfig.profiles as ProfileConfig[];
  const profileIds: Record<string, string> = {};

  const profilesData = profiles.map((profile) => {
    const id = faker.string.uuid();
    profileIds[profile.user_email] = id;
    const userConfig = users.find((u) => u.email === profile.user_email);
    return {
      id,
      user_id: userIds[profile.user_email],
      slug: profile.slug,
      headline: profile.role_title,
      bio: userConfig?.bio || null,
      industry: userConfig?.industry || null,
      location: "Singapore",
      qr_code_url: null,
      visibility: "public",
      is_verified: profile.profile_maturity === "veteran",
      total_reviews: profile.review_count,
      expertise_count: Math.round(profile.review_count * 1.4 * (profile.quality_distribution.expertise || 0)),
      care_count: Math.round(profile.review_count * 1.4 * (profile.quality_distribution.care || 0)),
      delivery_count: Math.round(profile.review_count * 1.4 * (profile.quality_distribution.delivery || 0)),
      initiative_count: Math.round(profile.review_count * 1.4 * (profile.quality_distribution.initiative || 0)),
      trust_count: Math.round(profile.review_count * 1.4 * (profile.quality_distribution.trust || 0)),
      created_at: now,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("profiles", profilesData);
  console.log(`Created ${profilesData.length} profiles`);

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
      role_title: profile.role_title,
      is_current: true,
      tagged_at: faker.date.past({ years: 1 }),
      untagged_at: null,
    });

    // Past orgs (Ramesh)
    for (const pastSlug of profile.past_org_slugs) {
      const taggedAt = faker.date.past({ years: 3 });
      const untaggedAt = faker.date.between({ from: taggedAt, to: now });
      profileOrgsData.push({
        id: faker.string.uuid(),
        profile_id: profileId,
        organization_id: orgIds[pastSlug],
        role_title: null,
        is_current: false,
        tagged_at: taggedAt,
        untagged_at: untaggedAt,
      });
    }
  }

  await queryInterface.bulkInsert("profile_organizations", profileOrgsData);
  console.log(`Created ${profileOrgsData.length} profile-org associations`);

  // -------------------------------------------------------
  // 5. REVIEWS + REVIEW MEDIA + VERIFIABLE REFERENCES
  // -------------------------------------------------------
  const reviewsData: any[] = [];
  const reviewMediaData: any[] = [];
  const verifiableRefsData: any[] = [];

  const mediaDistribution = seedConfig.review_media_distribution;
  const verificationLevels = seedConfig.verification_levels;
  const textSamples = seedConfig.review_templates.text_samples;
  const voiceUrls = seedConfig.review_templates.voice_placeholder_urls;
  const videoUrls = seedConfig.review_templates.video_placeholder_urls;

  let totalReviews = 0;
  let totalMedia = 0;
  let totalVerifiable = 0;

  for (const profile of profiles) {
    const profileId = profileIds[profile.user_email];
    const monthCounts = assignReviewsToMonths(profile.review_count);
    let verifiableRemaining = profile.verifiable_reference_count;
    let reviewIndex = 0;

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
        let fraudScore: number;
        let isVerifiedInteraction = false;
        if (verRoll < verificationLevels.basic_review) {
          fraudScore = 30;
        } else if (verRoll < verificationLevels.basic_review + verificationLevels.verified_review) {
          fraudScore = 70;
        } else if (verRoll < verificationLevels.basic_review + verificationLevels.verified_review + verificationLevels.verified_interaction) {
          fraudScore = 90;
          isVerifiedInteraction = true;
        } else {
          // verified_testimonial requires voice or video
          if (mediaType === "voice" || mediaType === "video") {
            fraudScore = 100;
            isVerifiedInteraction = true;
          } else {
            fraudScore = 90;
            isVerifiedInteraction = true;
          }
        }

        // Quality picks
        const picks = pickQualities(profile.quality_distribution);

        // Verifiable reference opt-in
        const shouldOptIn = verifiableRemaining > 0 && (verifiableRemaining / (profile.review_count - reviewIndex)) > Math.random();
        if (shouldOptIn) {
          verifiableRemaining--;
        }

        // Create review
        reviewsData.push({
          id: reviewId,
          profile_id: profileId,
          reviewer_phone_hash: faker.string.alphanumeric(64),
          quality_picks: JSON.stringify(picks),
          device_fingerprint_hash: faker.string.alphanumeric(64),
          location_lat: 1.3521 + (Math.random() - 0.5) * 0.05,
          location_lng: 103.8198 + (Math.random() - 0.5) * 0.05,
          review_token_id: null,
          is_verified_interaction: isVerifiedInteraction,
          fraud_score: fraudScore,
          created_at: timestamp,
        });

        // Create media
        if (mediaType === "text") {
          const textContent = industrySamples[reviewIndex % industrySamples.length];
          reviewMediaData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            media_type: "text",
            content_text: textContent,
            media_url: null,
            duration_seconds: null,
            transcription: null,
            is_moderated: true,
            moderation_status: "approved",
            created_at: timestamp,
          });
          totalMedia++;
        } else if (mediaType === "voice") {
          reviewMediaData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            media_type: "voice",
            content_text: null,
            media_url: voiceUrls[reviewIndex % voiceUrls.length],
            duration_seconds: faker.number.int({ min: 5, max: 15 }),
            transcription: null,
            is_moderated: false,
            moderation_status: "pending",
            created_at: timestamp,
          });
          totalMedia++;
        } else if (mediaType === "video") {
          reviewMediaData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            media_type: "video",
            content_text: null,
            media_url: videoUrls[reviewIndex % videoUrls.length],
            duration_seconds: faker.number.int({ min: 10, max: 30 }),
            transcription: null,
            is_moderated: false,
            moderation_status: "pending",
            created_at: timestamp,
          });
          totalMedia++;
        }

        // Verifiable reference record
        if (shouldOptIn) {
          verifiableRefsData.push({
            id: faker.string.uuid(),
            review_id: reviewId,
            reviewer_phone_hash: faker.string.alphanumeric(64),
            is_contactable: true,
            opted_in_at: timestamp,
            withdrawn_at: null,
            contact_count: 0,
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
  console.log(`Created ${totalReviews} reviews`);

  if (reviewMediaData.length > 0) {
    await queryInterface.bulkInsert("review_media", reviewMediaData);
    console.log(`Created ${totalMedia} review media records`);
  }

  if (verifiableRefsData.length > 0) {
    await queryInterface.bulkInsert("verifiable_references", verifiableRefsData);
    console.log(`Created ${totalVerifiable} verifiable references`);
  }

  // -------------------------------------------------------
  // 6. QUALITIES (seeded reference data)
  // -------------------------------------------------------
  const qualitiesData = [
    { id: faker.string.uuid(), name: "expertise", label: "Expertise", description: "Deep knowledge and skill in their domain", customer_language: "Expert in their domain", sort_order: 1, created_at: now, updated_at: now },
    { id: faker.string.uuid(), name: "care", label: "Care", description: "Genuine concern for the customer experience", customer_language: "Made me feel valued", sort_order: 2, created_at: now, updated_at: now },
    { id: faker.string.uuid(), name: "delivery", label: "Delivery", description: "Reliability and follow-through on promises", customer_language: "Did exactly what they promised", sort_order: 3, created_at: now, updated_at: now },
    { id: faker.string.uuid(), name: "initiative", label: "Initiative", description: "Proactive behavior beyond expectations", customer_language: "Went beyond what I asked", sort_order: 4, created_at: now, updated_at: now },
    { id: faker.string.uuid(), name: "trust", label: "Trust", description: "Reliability and integrity that earns repeat business", customer_language: "I'd come back to this person", sort_order: 5, created_at: now, updated_at: now },
  ];

  await queryInterface.bulkInsert("qualities", qualitiesData);
  console.log(`Created ${qualitiesData.length} qualities`);

  // Quality scores per profile
  const qualityIds: Record<string, string> = {};
  qualitiesData.forEach((q) => { qualityIds[q.name] = q.id; });

  const qualityScoresData: any[] = [];
  for (const profile of profiles) {
    const profileId = profileIds[profile.user_email];
    for (const quality of QUALITIES) {
      const pct = profile.quality_distribution[quality] || 0;
      const pickCount = Math.round(profile.review_count * 1.4 * pct);
      qualityScoresData.push({
        id: faker.string.uuid(),
        profile_id: profileId,
        quality_id: qualityIds[quality],
        pick_count: pickCount,
        percentage: pct * 100,
        updated_at: now,
      });
    }
  }

  await queryInterface.bulkInsert("quality_scores", qualityScoresData);
  console.log(`Created ${qualityScoresData.length} quality scores`);

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
      tier: sub.plan,
      stripe_customer_id: `cus_demo_${faker.string.alphanumeric(14)}`,
      stripe_subscription_id: `sub_demo_${faker.string.alphanumeric(14)}`,
      status: sub.status,
      current_period_start: startDate,
      current_period_end: endDate,
      created_at: startDate,
      updated_at: now,
    };
  });

  await queryInterface.bulkInsert("subscriptions", subsData);
  console.log(`Created ${subsData.length} subscriptions`);

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  console.log("\nDemo user credentials:");
  console.log("-------------------------------------------");
  users.forEach((user) => {
    console.log(
      `${user.role.padEnd(12)} ${user.tier.padEnd(20)} ${user.email}`,
    );
  });
  console.log("-------------------------------------------");
  console.log(`\nSeeding complete!`);
  console.log(`   ${usersData.length} users`);
  console.log(`   ${orgsData.length} organizations`);
  console.log(`   ${profilesData.length} profiles`);
  console.log(`   ${profileOrgsData.length} profile-org associations`);
  console.log(`   ${totalReviews} reviews`);
  console.log(`   ${totalMedia} media records`);
  console.log(`   ${totalVerifiable} verifiable references`);
  console.log(`   ${qualitiesData.length} qualities`);
  console.log(`   ${qualityScoresData.length} quality scores`);
  console.log(`   ${subsData.length} subscriptions\n`);
};

export const down: Migration = async ({ context: sequelize }) => {
  const queryInterface = sequelize.getQueryInterface();

  console.log("Cleaning all seed data (FK-safe order)...");

  // Delete in reverse foreign key order
  await queryInterface.bulkDelete("quality_scores", {});
  await queryInterface.bulkDelete("qualities", {});
  await queryInterface.bulkDelete("verifiable_references", {});
  await queryInterface.bulkDelete("review_media", {});
  await queryInterface.bulkDelete("reviews", {});
  await queryInterface.bulkDelete("subscriptions", {});
  await queryInterface.bulkDelete("profile_organizations", {});
  await queryInterface.bulkDelete("profiles", {});
  await queryInterface.bulkDelete("organizations", {});
  await queryInterface.bulkDelete("users", {});

  console.log("All seed data deleted successfully!");
};
