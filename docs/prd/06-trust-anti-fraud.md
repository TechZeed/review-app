# PRD 06: Trust & Anti-Fraud — Five-Layer Verification Stack

**Product:** Every Individual is a Brand — Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**Theme:** Theme 6 from brainstorm session (Ideas #40-#46)

---

## 1. Overview

Trust is existential for this product. The entire value proposition — "customer-verified reputation that travels with the individual" — collapses the moment fake reviews enter the system. Unlike LinkedIn (where endorsements are meaningless because they cost nothing and verify nothing) or Glassdoor (where anonymity invites abuse), this app's credibility is its product.

If a recruiter paying $500-1,000/month discovers even one fake review in a candidate's profile, they stop trusting every review. If a frontline worker's hard-earned reputation sits next to manufactured praise, the real reviews lose value. Trust is not a feature. It is the product.

### Why This Matters Now

The review fraud landscape is massive and getting worse:

| Platform | Fake Review Problem |
|----------|-------------------|
| **Amazon** | Blocked 275M+ suspected fake reviews in a single year |
| **Google** | Removed 240M+ policy-violating reviews and contributions (2023) |
| **Yelp** | ~9% of reviews flagged and removed — with significant collateral damage to legitimate reviews |
| **TripAdvisor** | Blocked 1.3M+ fraudulent reviews (2023) |

These platforms fight fraud after the fact because their architecture allows anyone to review anything from anywhere. We have a structural advantage that lets us prevent fraud by design.

---

## 2. Structural Advantage: QR Scan as Proof of Presence

The fundamental difference between this app and every existing review platform:

| Platform | Review Entry Point | Proof of Interaction |
|----------|-------------------|---------------------|
| Google Reviews | Open URL, anyone can post | None |
| Yelp | Open URL, anyone can post | None |
| Amazon | Must have purchased (sometimes) | Weak — "Verified Purchase" easily gamed |
| LinkedIn Endorsements | One-click from any connection | None |
| **This App** | **Physical QR code scan** | **Timestamp + location + device = proof of presence** |

The QR scan requirement eliminates the entire category of "drive-by internet reviews" that plagues every competitor. A reviewer must be physically present with the individual to initiate the review flow. This single architectural decision blocks an estimated 90% of fake review attack vectors before any AI or verification layer kicks in.

---

## 3. Five-Layer Anti-Fraud Stack

Each layer is independent and cumulative. A review that passes all five layers earns the highest trust score. A review that passes only Layer 1 is still more verified than any Google or LinkedIn review.

### Layer 1: QR Scan — Proof of Presence

**Purpose:** Establish that the reviewer was physically co-located with the individual being reviewed.

**Data captured on scan:**

| Signal | Detail | Storage |
|--------|--------|---------|
| Timestamp | ISO 8601, server-validated (not client clock) | Permanent |
| GPS coordinates | Latitude/longitude at scan time (if permission granted) | Hashed, stored 90 days, then deleted |
| Device fingerprint | Browser/OS/screen resolution/language composite hash | Hashed, permanent |
| QR token ID | Unique per scan, single-use | Permanent |

**Behavior:**
- QR code encodes a URL with a rotating token component (changes every 60 seconds)
- Server validates token freshness — scans of screenshot'd or photocopied QR codes with stale tokens are rejected
- Location is requested but not required (graceful degradation — review proceeds without it but loses location verification credit)
- Device fingerprint is a composite hash, not raw data — no individual tracking capability

**What it stops:** Remote review attacks, bulk URL sharing, bot-generated reviews from random locations.

**Fraud score contribution:** +30 points (out of 100) toward "Verified Interaction" status.

### Layer 2: Phone OTP — One Person, One Review

**Purpose:** Bind each review to a unique human identity via phone number.

**Rules:**

| Rule | Specification |
|------|--------------|
| OTP delivery | SMS or WhatsApp, 6-digit code, 5-minute expiry |
| Rate limit per phone | One review per individual per 7-day rolling window |
| Rate limit per device | Maximum 3 different phone numbers per device per 30 days |
| Phone number storage | Hashed with per-user salt — never stored in plain text |
| Recycled numbers | If a phone number is re-verified after 12+ months of inactivity, previous reviews remain but new reviews start a fresh identity chain |

**Behavior:**
- OTP screen appears after quality taps are selected (not before — avoid friction before value delivery)
- First-time reviewers: OTP required
- Returning reviewers (same phone hash seen before): OTP skipped if same device fingerprint, otherwise re-verify
- Failed OTP attempts: 3 attempts, then 15-minute cooldown, then 3 more, then 24-hour lockout

**What it stops:** Self-review attacks ("scan my own QR 50 times"), single-device review farming, bot accounts.

**Fraud score contribution:** +25 points toward "Verified Interaction" status.

### Layer 3: Time-Window Token — Review Must Be Fresh

**Purpose:** Ensure the review reflects a recent interaction, not a manufactured historical one.

**Rules:**

| Rule | Specification |
|------|--------------|
| Token validity | 48 hours from QR scan timestamp |
| Extension | None — hard cutoff |
| Token storage | Server-side only, not in URL or client storage |
| Expired token behavior | Reviewer sees "This review link has expired. Please scan the QR code again." |
| Token reuse | Single-use — once a review is submitted, the token is consumed |

**Behavior:**
- On QR scan, server generates a review session token with 48-hour TTL
- Token is bound to: (a) the individual being reviewed, (b) the device fingerprint, (c) the phone hash (once OTP completes)
- Partial reviews (started but not submitted) can be resumed within the window
- No token stockpiling — each scan produces exactly one token

**What it stops:** Review farming operations, historical fake review injection, token hoarding for coordinated attacks.

**Fraud score contribution:** +15 points toward "Verified Interaction" status.

### Layer 4: AI Pattern Detection — Behavioral Analysis

**Purpose:** Detect coordinated and sophisticated fraud that passes Layers 1-3.

**Detection signals:**

| Signal | Threshold | Action |
|--------|-----------|--------|
| **Velocity spike** | Individual receives >10 reviews in 24 hours (vs. their 30-day average) | Flag for manual review, delay publication by 24 hours |
| **Device clustering** | Same device fingerprint reviews >3 different individuals within 24 hours | Flag device, require enhanced verification for subsequent reviews |
| **Location clustering** | >5 reviews from GPS coordinates within 50m radius in <1 hour (excluding known high-traffic venues) | Flag batch, investigate |
| **Quality pick patterns** | >80% of reviews for an individual select identical quality combinations | Flag as potential scripted reviews |
| **Text similarity** | NLP similarity score >0.85 across reviews for the same individual | Flag, suppress duplicates |
| **Timing patterns** | Reviews consistently arrive at exact intervals (e.g., every 15 minutes) | Flag as bot-like behavior |
| **Cross-individual patterns** | Same phone hash leaves 5-star reviews for >10 individuals in 30 days | Flag phone hash as potential review-for-hire |

**Model architecture:**
- Rule-based engine for known patterns (Phase 1 — launch)
- ML anomaly detection model trained on labeled fraud data (Phase 2 — 6 months post-launch)
- Continuous learning: flagged-and-confirmed fraud feeds back into the model

**Actions on detection:**

| Confidence | Action |
|------------|--------|
| Low (50-70%) | Review published with reduced visibility, internal flag for monitoring |
| Medium (70-90%) | Review held for 48-hour manual review queue |
| High (90%+) | Review suppressed, reviewer notified, individual notified of attempted fraud |

**Fraud score contribution:** +20 points toward "Verified Interaction" status (awarded when no flags triggered).

### Layer 5: Video/Voice as Trust Amplifier

**Purpose:** Make high-value reviews nearly impossible to fake at scale.

**Specifications:**

| Feature | Video | Voice |
|---------|-------|-------|
| Max duration | 30 seconds | 15 seconds |
| Recording | In-app only, no uploads from gallery | In-app only, no uploads |
| Liveness check | Front camera required, face detection confirms human presence | Voice activity detection confirms live speech |
| Storage | Compressed, encrypted at rest, CDN-delivered | Compressed, encrypted at rest |
| Badge earned | "Verified Testimonial" | "Verified Testimonial" |

**Why this works:**
- Generating 100 fake text reviews costs ~$50 on Fiverr
- Generating 100 fake video reviews with unique faces and voices is operationally impractical and cost-prohibitive
- Video/voice carries authenticity markers (emotion, spontaneity, environment sounds) that are extremely difficult to synthesize convincingly at scale
- AI-generated deepfake detection layer runs on uploaded video (Phase 2)

**Fraud score contribution:** +10 points toward "Verified Interaction" status.

---

## 4. "Verified Interaction" Badge System

Reviews that pass verification layers earn trust badges displayed on the individual's profile.

### Badge Tiers

| Badge | Requirements | Visual | Display |
|-------|-------------|--------|---------|
| **Basic Review** | Layer 1 (QR scan) only | Gray checkmark | Shown but de-emphasized |
| **Verified Review** | Layers 1 + 2 + 3 (QR + OTP + time window) | Blue checkmark | Standard display |
| **Verified Interaction** | Layers 1 + 2 + 3 + 4 pass (no AI flags) | Green shield | Prominent display |
| **Verified Testimonial** | All 5 layers (includes video or voice) | Gold star with shield | Featured on profile, highlighted to recruiters |

### Profile-Level Trust Score

The individual's profile displays an aggregate trust indicator (not a number — a tier):

| Tier | Criteria |
|------|----------|
| **Emerging** | <10 total reviews |
| **Established** | 10+ reviews, >50% are "Verified Review" or higher |
| **Trusted** | 25+ reviews, >70% are "Verified Interaction" or higher |
| **Highly Trusted** | 50+ reviews, >60% are "Verified Testimonial", at least 5 video reviews |

Recruiters see this tier prominently. It signals how much weight to put on the profile.

---

## 5. The Killer Insight: The Trust Bar

The trust bar for this product does not need to match bank-grade identity verification. It needs to beat the current alternatives:

| Alternative | Verification Level |
|-------------|-------------------|
| LinkedIn endorsement | Zero — one click from any connection, no proof of interaction |
| LinkedIn recommendation | Low — written by colleagues/managers, no customer involvement |
| Google/Yelp review | Low — no proof the reviewer ever interacted with the business |
| Traditional references | Medium — hand-picked, rehearsed, stale |
| **This app (Layer 1 only)** | **Already higher than all of the above** |
| **This app (all 5 layers)** | **Higher than anything in the market** |

The QR scan alone — proof that the reviewer was physically present — already surpasses every existing professional reputation signal. Each additional layer widens the gap. We do not need perfection. We need to be credibly better than the status quo, and the architecture guarantees that from day one.

---

## 6. Feature Requirements

### P0 — Must Have for Launch

| ID | Feature | Description |
|----|---------|-------------|
| TF-001 | QR token rotation | QR code URL contains a rotating token (60s TTL) validated server-side |
| TF-002 | Device fingerprinting | Composite hash of browser/OS/screen/language captured on scan |
| TF-003 | GPS capture (optional) | Request location permission; proceed without it if denied |
| TF-004 | Phone OTP | SMS/WhatsApp OTP, 6-digit, 5-minute expiry |
| TF-005 | One-review-per-phone-per-window | 7-day rolling window per phone-individual pair |
| TF-006 | Time-window token | 48-hour TTL, single-use, server-side only |
| TF-007 | Badge display | Show "Basic Review" / "Verified Review" badges on profile |
| TF-008 | Rate limiting | Device-level and phone-level rate limits as specified |

### P1 — Required Within 3 Months Post-Launch

| ID | Feature | Description |
|----|---------|-------------|
| TF-009 | Rule-based fraud detection | Velocity, clustering, pattern detection engine |
| TF-010 | Manual review queue | Admin interface for reviewing flagged reviews |
| TF-011 | Video recording (in-app) | Front-camera, 30s max, liveness check |
| TF-012 | Voice recording (in-app) | 15s max, voice activity detection |
| TF-013 | "Verified Interaction" badge | Awarded when Layers 1-4 pass |
| TF-014 | "Verified Testimonial" badge | Awarded when all 5 layers pass |
| TF-015 | Profile trust tier | Aggregate trust tier on individual profiles |

### P2 — Required Within 6-12 Months Post-Launch

| ID | Feature | Description |
|----|---------|-------------|
| TF-016 | ML anomaly detection | Trained model replacing/augmenting rule-based engine |
| TF-017 | Deepfake detection | AI screening of video submissions for synthetic media |
| TF-018 | Fraud dashboard | Analytics for fraud rate, detection accuracy, false positives |
| TF-019 | Reviewer reputation score | Internal score for reviewers based on their review history patterns |
| TF-020 | Verifiable reference opt-in | Customer can agree to be contacted by potential employers (ties to Theme 7) |

---

## 7. User Stories

### Reviewer (Customer)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-01 | As a customer, I scan the QR code and complete a review in under 60 seconds so that leaving feedback is effortless | QR scan to submission in <60s for a quality-tap-only review |
| US-02 | As a customer, I verify my phone number once and am not asked again on the same device so that repeat reviews are frictionless | Returning reviewer on same device skips OTP |
| US-03 | As a customer, I record a short video testimonial so that my endorsement carries more weight | Video recording in-app, front camera, 30s max, "Verified Testimonial" badge shown |
| US-04 | As a customer, I understand why I am being asked for my phone number so that I feel comfortable providing it | Clear explanation text: "Your phone number is used to verify one review per person. It is never shared or stored in readable form." |

### Individual (Profile Owner)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-05 | As an individual, I see trust badges on my reviews so I know which ones carry the most verification weight | Each review displays its badge tier |
| US-06 | As an individual, I am notified when a suspected fake review is detected and suppressed on my profile | Push/email notification with summary (not details of detection method) |
| US-07 | As an individual, I see my profile trust tier so I know how credible my profile appears to recruiters | Trust tier displayed on profile settings page |
| US-08 | As an individual, I can report a review I believe is fraudulent so that it enters the manual review queue | "Report" button on each review, triggers manual review |

### Recruiter

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-09 | As a recruiter, I see the trust tier on candidate profiles so I can assess review credibility at a glance | Trust tier badge visible on search results and profile pages |
| US-10 | As a recruiter, I can filter candidates by minimum trust tier so I only see well-verified profiles | Filter options: Established, Trusted, Highly Trusted |
| US-11 | As a recruiter, I can distinguish "Verified Testimonial" (video) reviews from text-only reviews so I can watch the most credible endorsements | Video reviews highlighted with gold badge, playable inline |

### Admin / Operations

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-12 | As an admin, I review flagged reviews in a queue with fraud signals displayed so I can make informed moderation decisions | Queue shows: fraud score, triggered signals, review content, reviewer history |
| US-13 | As an admin, I see a fraud analytics dashboard so I can monitor system health | Dashboard shows: fraud rate, detection accuracy, false positive rate, badge distribution |

---

## 8. Success Metrics

### Primary Metrics

| Metric | Target (Launch) | Target (6 months) | Target (12 months) |
|--------|----------------|-------------------|-------------------|
| Fake review rate (detected + confirmed) | <5% of all reviews | <2% | <1% |
| AI detection accuracy (precision) | N/A (rule-based) | >85% | >92% |
| AI detection recall | N/A | >80% | >90% |
| False positive rate | <3% | <2% | <1% |
| OTP completion rate | >75% | >80% | >85% |

### Badge Distribution Targets

| Badge | Target Distribution (steady state) |
|-------|-----------------------------------|
| Basic Review (QR only) | <15% of total reviews |
| Verified Review (QR + OTP + time) | 50-60% |
| Verified Interaction (+ AI clear) | 25-35% |
| Verified Testimonial (+ video/voice) | 5-10% |

### Operational Metrics

| Metric | Target |
|--------|--------|
| Manual review queue turnaround | <24 hours |
| Time from QR scan to review submission (median) | <45 seconds |
| Location permission grant rate | >40% |
| Video/voice attachment rate | >8% of all reviews |
| Reviewer drop-off at OTP step | <20% |

---

## 9. Privacy Considerations

Trust verification collects sensitive data. The system must be designed for privacy by default, not bolted on afterward.

### Data Collection & Storage

| Data | Collected | Stored As | Retention | User Control |
|------|-----------|-----------|-----------|--------------|
| Phone number | Yes (OTP) | Salted hash only — plain text never persisted | Permanent (hash only) | Reviewer can request deletion — hash is purged, reviews become "unverified" |
| GPS coordinates | Yes (if permitted) | Encrypted, access-logged | 90 days, then auto-deleted | Reviewer can deny permission; review proceeds without location verification |
| Device fingerprint | Yes | Composite hash — no individual component stored | Permanent (hash only) | Cannot be tied back to a specific device without the original signals |
| Video/voice | Yes (if provided) | Encrypted at rest, CDN-delivered over TLS | Permanent (unless reviewer requests deletion) | Reviewer can delete their video/voice at any time |
| IP address | Yes (server logs) | Raw in logs, not in review data | 30 days in logs, then purged | Standard log retention |

### GDPR & Regulatory Compliance

| Requirement | Implementation |
|-------------|---------------|
| Lawful basis | Legitimate interest (fraud prevention) for device fingerprint and location; consent for OTP and video/voice |
| Right to erasure | Reviewer can request full data deletion; reviews revert to "Basic Review" badge (content preserved, verification data purged) |
| Right to access | Reviewer can export all data associated with their phone hash |
| Data minimization | No raw phone numbers stored; no raw device data stored; location auto-deleted after 90 days |
| Consent UX | Clear, plain-language permission requests at each data collection point — no dark patterns, no bundled consent |
| Data Processing Agreement | Required for any third-party OTP provider (Twilio, etc.) |
| Cross-border transfers | Video/voice CDN must comply with data residency requirements per user's jurisdiction |

### Privacy Principles

1. **Hash everything possible.** Phone numbers and device fingerprints are stored as one-way hashes. There is no "unhash" capability.
2. **Graceful degradation.** Denying location or skipping video does not block the review — it reduces the badge tier, nothing more.
3. **Transparency over surveillance.** The reviewer sees exactly what data is collected and why, at the moment it is collected.
4. **No behavioral tracking.** Device fingerprints are used exclusively for fraud detection, never for advertising, profiling, or cross-platform tracking.
5. **Deletion is real.** When a reviewer requests deletion, the data is purged — not soft-deleted, not archived. The review text remains but loses its verification status.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OTP friction causes reviewer drop-off | High | Medium | Skip OTP for returning reviewers on recognized devices; A/B test placement |
| Location permission denial rates are high | High | Low | Location is optional; badge system incentivizes but does not require it |
| Sophisticated fraud rings bypass Layers 1-3 | Medium | High | Layer 4 AI detection designed specifically for coordinated attacks; manual review as backstop |
| False positives suppress legitimate reviews | Medium | High | Conservative thresholds at launch; human review for medium-confidence flags; feedback loop to improve model |
| Deepfake video reviews | Low (now), Medium (future) | High | Phase 2 deepfake detection; in-app-only recording reduces attack surface |
| Privacy regulation changes | Medium | Medium | Privacy-by-design architecture; minimal data collection; easy to tighten without architectural changes |

---

## 11. Open Questions

1. **OTP cost at scale:** SMS OTP costs $0.01-0.05 per message. At 100K reviews/month, this is $1K-5K/month. Should we prioritize WhatsApp OTP (free/cheaper) or explore silent verification (network-based)?
2. **QR rotation frequency:** 60-second rotation is specified, but does this create UX friction if the customer takes >60 seconds to open their camera? Should the previous token remain valid for an additional 60-second grace period?
3. **International phone numbers:** OTP delivery reliability varies by country. What is the launch market, and which OTP providers have the best delivery rates there?
4. **Employer fraud:** What if an employer pressures employees to solicit fake reviews? Should there be an anonymous reporting channel for employees?
5. **Review bombing:** What if a disgruntled person scans the QR and leaves a negative review? Layer 2 limits frequency, but the damage from even one verified negative review could be significant. What is the dispute resolution process?
