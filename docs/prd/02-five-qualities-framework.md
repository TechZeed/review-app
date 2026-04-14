# PRD 02: The Five Qualities Framework

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**Related brainstorm ideas:** #11, #14, #15, #16, #17, #18, #20, #21

---

## 1. Overview

### Why Five Qualities, Not Star Ratings

Star ratings fail for individual reputation because they collapse everything into a single dimension. A 4.2-star nurse tells you nothing. A nurse whose profile shows **Care** and **Expertise** as dominant qualities tells you exactly who she is.

The Five Qualities Framework replaces star ratings with a multi-dimensional profile that answers the question: **"What is this person known for?"** instead of "How good is this person on a scale of 1 to 5?"

Key problems with star ratings for individuals:
- **No differentiation.** A 4.5 and a 4.6 are meaningless distinctions. Five qualities create unique signatures.
- **No actionability.** Star ratings don't tell you what the person is good at. Qualities do.
- **Rating inflation.** Stars trend toward 4.7+ and lose signal. Quality picks distribute across dimensions and maintain signal.
- **Wrong mental model.** Customers don't think "this person is a 4 out of 5." They think "this person really knew their stuff" or "this person went above and beyond."

The framework asks customers: **"What stood out about this person?"** -- a question they can answer instantly and honestly.

---

## 2. Research Foundation

### SERVQUAL / RATER Model Adaptation

The Five Qualities are adapted from the SERVQUAL model (Parasuraman, Zeithaml & Berry, 1988), the most widely cited academic framework for service quality measurement. The original RATER dimensions are:

| RATER Dimension | Our Quality | Adaptation Rationale |
|-----------------|-------------|---------------------|
| **R**eliability | **Delivery** | Reframed from org-level consistency to individual follow-through |
| **A**ssurance | **Trust** | Elevated from "confidence in the org" to "personal loyalty to the individual" |
| **T**angibles | *(Replaced)* | Physical facilities/equipment is org-level, not individual-level. Replaced with **Initiative** -- proactive behavior is the individual-level differentiator that Tangibles cannot capture. |
| **E**mpathy | **Care** | Direct mapping -- individualized attention, making the customer feel valued |
| **R**esponsiveness | **Expertise** | Reframed from "willingness to help promptly" to "applied domain knowledge" -- the individual's core professional competence |

### Why This Matters

SERVQUAL has been validated across 30+ years of research in hospitality, banking, healthcare, retail, and telecom. We are not inventing new dimensions -- we are adapting proven ones for individual-level measurement. This gives us:

1. Academic defensibility when selling to enterprise HR and recruiting buyers.
2. Cross-industry validity without needing industry-specific customization.
3. A framework customers intuitively understand because it maps to how they naturally evaluate service experiences.

---

## 3. Quality Definitions

### 3.1 Expertise -- "Expert in their domain"

**What it measures:** Applied knowledge and professional competence. Not what you know on paper, but what you can do in practice.

**Customer trigger:** The customer felt the person deeply understood the domain and used that knowledge to help them effectively.

**Example signals:**
- "She knew exactly which loan product fit my situation."
- "He explained the medication interactions clearly."
- "She knew every model's towing capacity off the top of her head."

---

### 3.2 Care -- "Made me feel valued"

**What it measures:** Genuine attention, empathy, and individualized treatment. The customer felt like a person, not a ticket number.

**Customer trigger:** The customer felt listened to, understood, and treated as an individual.

**Example signals:**
- "He remembered I was anxious about the procedure and checked in on me."
- "She didn't rush me even though the store was busy."
- "He actually listened to my budget constraints instead of upselling."

---

### 3.3 Delivery -- "Did exactly what they promised"

**What it measures:** Reliability, follow-through, accuracy. Promises made = promises kept.

**Customer trigger:** The customer got exactly what was committed, on time, without having to chase.

**Example signals:**
- "She said the paperwork would be done by Thursday. It was done Wednesday."
- "The room was exactly as described, no surprises."
- "He followed up with the quote the same day like he said he would."

---

### 3.4 Initiative -- "Went beyond what I asked"

**What it measures:** Proactive, extra-mile behavior. Doing things the customer did not ask for but benefited from.

**Customer trigger:** The customer was surprised by something helpful they did not expect or request.

**Example signals:**
- "She found me a better rate I didn't even know existed."
- "He noticed a recall on my car and scheduled the fix while I was there."
- "She upgraded my room without me asking."

---

### 3.5 Trust -- "I'd come back to this person"

**What it measures:** The ultimate endorsement -- personal loyalty. The customer would seek out this specific individual again.

**Customer trigger:** The cumulative experience was strong enough that the customer formed a personal attachment to the individual, not just the org.

**Example signals:**
- "I'd send my mother to him."
- "Next time I'm at that hotel, I'm requesting her."
- "I switched branches just to keep working with her."

---

## 4. Cross-Industry Validation Matrix

Each quality must work universally without industry-specific modification. The table below validates this across six representative frontline roles:

| Role | Expertise | Care | Delivery | Initiative | Trust |
|------|-----------|------|----------|------------|-------|
| **Car salesperson** | Knows models, financing options, trade-in values | Listened to my budget and lifestyle needs | Got me the exact deal promised, no last-minute changes | Found a better financing option I didn't ask about | I'd send my friend to buy from them |
| **Hotel concierge** | Knows the city, restaurants, transit, events | Remembered my preferences from last visit | Booked exactly what I wanted, confirmed details | Surprised me with a room upgrade | I'd request them by name next stay |
| **Bank relationship manager** | Knows products, regulations, tax implications | Understood my financial anxiety, didn't condescend | Processed my loan on time with no errors | Flagged a better rate proactively before I asked | I'd trust them with my retirement savings |
| **Nurse** | Clinical competence, accurate assessment | Made me feel safe and informed | Administered care correctly, on schedule | Checked on me after their shift ended | I'd want them if I'm ever back |
| **Retail associate** | Deep product knowledge, alternatives awareness | Didn't pressure, let me browse, answered patiently | Had the item shipped to my home as promised | Suggested an accessory that genuinely improved my purchase | I'd go back to that store for them |
| **Restaurant server** | Knows the menu, pairings, allergen info | Noticed my kid was restless and brought crayons | Order was accurate, timing was right | Brought a complimentary dessert for a birthday | I'd sit in their section every time |

**Validation criteria met:** All five qualities produce meaningful, distinct signals for every role. No quality is irrelevant to any role. No role requires a sixth quality.

---

## 5. Profile Display

### 5.1 Quality Heat Map

The primary profile visualization is a **quality heat map** showing the relative distribution of quality picks across all reviews.

**Display specification:**

```
[Profile Name]
[Role] at [Org] (or independent)

  Expertise  ████████████████░░░░  42%
  Care       ██████████████░░░░░░  35%
  Delivery   ████████░░░░░░░░░░░░  20%
  Initiative ██████░░░░░░░░░░░░░░  15%
  Trust      ████████████████████  52%

  Based on 347 quality picks from 214 reviews
```

**Design rules:**
- Bars are proportional to percentage of reviews that picked each quality.
- Percentages can exceed 100% in total because each review can pick 1-2 qualities.
- Color intensity scales with percentage. Higher = more saturated.
- Always show the total number of quality picks and reviews for transparency.

### 5.2 Signature Strengths

When a quality is picked in **40% or more** of all reviews, it becomes a **Signature Strength** and receives a badge on the profile.

**Display:**
- Signature Strengths appear as highlighted badges at the top of the profile.
- Maximum of 3 Signature Strengths can be displayed (if someone has 4+ above 40%, show the top 3).
- Label format: "Known for [Quality]" -- e.g., "Known for Care," "Known for Expertise & Trust."

**Why 40%:** At 40%+ with 50+ reviews, the signal is statistically meaningful. Below 40%, it could be noise. Above 50+ reviews, sample size is sufficient for confidence.

### 5.3 Quality Trend (Pro Feature)

Pro users see how their quality distribution has shifted over time (quarterly view). This lets individuals see if they are improving in specific areas.

---

## 6. Aggregation Model

### How Picks Become Signature Strengths

**Input:** Each review includes 1-2 quality picks (mandatory). The reviewer taps the qualities that stood out.

**Aggregation logic:**

1. **Count picks per quality.** For each of the five qualities, count the total number of times it has been picked across all reviews.
2. **Calculate percentage.** `quality_percentage = (picks_for_quality / total_reviews) * 100`. Note: total can exceed 100% because reviewers pick 1-2 qualities.
3. **Determine Signature Strengths.** Any quality at or above 40% with a minimum of 20 picks is a Signature Strength.
4. **Rank for display.** Qualities are displayed in descending order of percentage on the heat map.

**Minimum thresholds:**

| Profile State | Reviews | Display Behavior |
|---------------|---------|-----------------|
| New | 0-4 | Show "New profile -- collecting reviews" placeholder. No heat map. |
| Emerging | 5-19 | Show heat map but label it "Early profile." No Signature Strengths yet. |
| Established | 20-49 | Full heat map. Signature Strengths eligible but labeled "Emerging strength." |
| Mature | 50+ | Full heat map. Signature Strengths shown with full confidence. |
| Veteran | 200+ | Full heat map. Signature Strengths + "Highly reviewed" badge. |

**Recency weighting:** Reviews from the last 12 months are weighted 2x compared to older reviews. This prevents a profile from being permanently defined by early reviews and rewards ongoing performance. Exact decay curve to be determined during implementation, but the principle is: recent reviews matter more.

**Why this works:** With hundreds of picks, random noise cancels out. If 200 customers independently pick "Care" for the same person, that is a real signal. The aggregation model turns individual data points into a reliable reputation signature.

---

## 7. Feature Requirements

### 7.1 Quality Selection UI (Reviewer Side)

| Requirement | Spec |
|-------------|------|
| Display all five qualities as tappable chips/cards | Each chip shows the quality name + customer-language subtitle |
| Allow 1-2 quality selections per review | Minimum 1, maximum 2. Enforce in UI. |
| Visual feedback on selection | Selected chip changes color/state. Deselect by tapping again. |
| No ordering bias | Randomize the display order of the five qualities on each review to prevent position bias |
| Accessibility | Each chip must be screen-reader accessible with the full description |
| Mandatory step | Review cannot be submitted without at least 1 quality pick |

### 7.2 Heat Map Display (Profile Side)

| Requirement | Spec |
|-------------|------|
| Render horizontal bar chart | One bar per quality, proportional to pick percentage |
| Show pick count and review count | "Based on X quality picks from Y reviews" |
| Responsive | Works on mobile (primary), tablet, and desktop |
| Update frequency | Real-time after each new review is processed |
| Minimum data threshold | Do not render heat map with fewer than 5 reviews |

### 7.3 Signature Strength Badges

| Requirement | Spec |
|-------------|------|
| Threshold | 40%+ of reviews, minimum 20 picks |
| Maximum displayed | 3 badges |
| Badge format | "Known for [Quality]" with quality icon |
| Placement | Top of profile, below name and role |
| Recalculation | On every new review |

### 7.4 Quality Trend (Pro)

| Requirement | Spec |
|-------------|------|
| Time series | Quarterly aggregation of quality percentages |
| Minimum data for trend | 3 quarters with 5+ reviews each |
| Visualization | Line chart, one line per quality |
| Export | Downloadable as part of Pro reputation report |

### 7.5 Randomization Engine

| Requirement | Spec |
|-------------|------|
| Chip order | Randomized per review session to eliminate position bias |
| Seed | Session-based (consistent within a single review, random across reviews) |
| Audit | Log the display order for each review for bias analysis |

---

## 8. User Stories

### Reviewer (Customer)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-Q1 | As a customer, I want to pick 1-2 qualities that stood out so I can express what made this person special without overthinking. | Quality chips displayed; tapping selects; 1-2 enforced; review submits successfully. |
| US-Q2 | As a customer, I want to see plain-language descriptions of each quality so I know what I'm picking. | Subtitle text visible on each chip (e.g., "Expert in their domain"). |
| US-Q3 | As a customer, I want the quality options to feel relevant regardless of the person's industry so I'm not confused by irrelevant options. | Same five qualities shown for all profiles. No industry-specific jargon. |

### Profile Owner (Individual)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-Q4 | As a frontline worker, I want to see which qualities my customers appreciate most so I know my professional strengths. | Heat map visible on my profile with percentage bars and counts. |
| US-Q5 | As a frontline worker, I want Signature Strength badges on my profile so visitors immediately see what I'm known for. | Badges appear when threshold met (40%, 20+ picks). Up to 3 shown. |
| US-Q6 | As a Pro user, I want to see how my quality scores have changed over time so I can track improvement. | Quarterly trend chart available in Pro dashboard. |
| US-Q7 | As a frontline worker, I want my quality profile to follow me when I change jobs so my reputation is portable. | Qualities and heat map persist after org untag. No data loss. |

### Employer

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-Q8 | As an employer, I want to see aggregate quality distributions across my team so I can identify strengths and coaching opportunities. | Employer dashboard shows team-level quality heat map. |
| US-Q9 | As a recruiter, I want to search for individuals by their Signature Strengths so I can find people known for specific qualities. | Search/filter by quality available in recruiter dashboard. |

---

## 9. Success Metrics

### Adoption Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Quality pick completion rate | >95% of submitted reviews include a quality pick | Reviews with picks / total submitted reviews |
| Average qualities picked per review | 1.4 - 1.7 | Total picks / total reviews (below 1.3 suggests confusion; above 1.8 suggests people just tap both) |
| Quality distribution entropy | No single quality >60% or <5% across all profiles globally | Aggregate distribution across platform |

### Quality Signal Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Position bias | <5% variance in pick rate by chip position | Compare pick rates across randomized positions |
| Signature Strength emergence rate | 70%+ of profiles with 50+ reviews have at least 1 Signature Strength | Profiles with SS / profiles with 50+ reviews |
| Quality differentiation | 80%+ of mature profiles have a non-uniform distribution (top quality at least 1.5x bottom quality) | Distribution spread analysis |

### Business Impact Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recruiter search-by-quality usage | 40%+ of recruiter searches include a quality filter | Searches with quality filter / total recruiter searches |
| Profile engagement with heat map | Heat map is viewed in 80%+ of profile visits | Heat map impression / profile page views |
| Employer quality coaching actions | 20%+ of employers reference quality data in dashboard usage | Feature engagement tracking |

---

## 10. Edge Cases

### 10.1 New Profile with Few Reviews (0-4 reviews)

**Problem:** A heat map with 2 reviews and 3 picks is misleading. One person's picks dominate the profile.

**Solution:** Do not display the heat map. Show a "New profile" placeholder with a progress indicator: "3 more reviews to unlock your quality profile." Show individual review quality picks inline with each review instead.

### 10.2 All Five Qualities Picked Equally

**Problem:** After 100 reviews, all five qualities hover around 20-25%. No Signature Strength emerges. The profile looks flat.

**Solution:** This is a valid outcome -- it means the person is a well-rounded generalist. Display a "Well-Rounded" badge instead of Signature Strengths. Label: "Consistently recognized across all five qualities." This is not a failure state; it is a distinct profile type.

### 10.3 Only One Quality Ever Picked

**Problem:** After 50 reviews, 90% of picks are "Trust" and everything else is near zero. The heat map looks like a single spike.

**Solution:** Display normally. This is a strong signal -- the person is overwhelmingly known for one thing. The Signature Strength badge for that quality gets an "Exceptional" modifier if it exceeds 70%: "Exceptionally known for Trust."

### 10.4 Reviewer Confusion -- Wrong Quality Selected

**Problem:** A customer meant to pick "Care" but tapped "Delivery" by accident. No way to know this happened.

**Solution:** At scale (50+ reviews), accidental picks become noise and wash out statistically. For the first 20 reviews, allow the reviewer to change their pick within 24 hours of submission (edit window). After 24 hours, picks are locked.

### 10.5 Gaming -- Self-Reviews Inflating a Specific Quality

**Problem:** The individual asks friends/family to scan their QR and pick "Expertise" repeatedly to inflate that quality.

**Solution:** Handled by the anti-fraud stack (PRD to be written separately -- Theme 6). Phone OTP, time-window tokens, and AI pattern detection catch coordinated pick patterns. From the quality framework side: flag profiles where a single quality has >80% picks with <30 total reviews as "under review" internally. Do not display a warning publicly.

### 10.6 Industry Role Change

**Problem:** A nurse with 200 reviews (heavy on Care and Expertise) switches to a bank RM role. Their old quality profile may not reflect their new role's strengths.

**Solution:** Quality data is never deleted. The heat map always reflects the full history (with recency weighting). The individual can add a "role change" marker on their timeline. The trend chart (Pro) will naturally show the shift. Old reviews remain valid -- Care as a nurse and Care as a bank RM measure the same underlying quality.

### 10.7 Quality Fatigue -- Reviewers Always Pick the Same Two

**Problem:** A frequent customer reviews the same person monthly and always picks the same qualities out of habit.

**Solution:** For repeat reviewers of the same individual (same phone number, same profile), after the 3rd review, subtly prompt: "Last time you highlighted Expertise and Care. Anything different this time?" This nudge breaks autopilot without being annoying. If they still pick the same, that is a valid signal.

### 10.8 Extremely High Volume Profile (1000+ reviews)

**Problem:** With 1000+ reviews, the quality distribution becomes very stable. New reviews barely move the needle. The profile feels static.

**Solution:** Recency weighting (12-month 2x multiplier) ensures recent performance still matters. Additionally, show a "Recent trend" mini-indicator next to each quality bar: an up arrow, down arrow, or steady indicator based on the last 90 days compared to the overall average. This keeps the profile feeling alive.

---

## Appendix A: Data Model (Preliminary)

```
QualityPick {
  id: UUID
  review_id: UUID (FK to Review)
  profile_id: UUID (FK to Profile)
  quality: ENUM(Expertise, Care, Delivery, Initiative, Trust)
  display_order: INT[5]  // logged order of chips shown to reviewer
  created_at: TIMESTAMP
}

QualityAggregate {
  profile_id: UUID (FK to Profile)
  quality: ENUM(Expertise, Care, Delivery, Initiative, Trust)
  total_picks: INT
  weighted_picks: FLOAT  // with recency weighting applied
  percentage: FLOAT
  is_signature_strength: BOOLEAN
  last_calculated_at: TIMESTAMP
}
```

---

## Appendix B: Open Questions

1. **Recency decay curve:** Linear decay or exponential? Needs A/B testing once there is sufficient data.
2. **Localization of quality names:** "Expertise" and "Initiative" may not translate cleanly to all languages. Conduct user testing in target markets.
3. **Accessibility of heat map:** Screen readers need a text-based alternative to the visual bar chart. Define ARIA spec during design phase.
4. **Quality pick limit -- 1 or 2?** The brainstorm says 1-2. Should we test forcing exactly 1 to see if signal improves? Candidate for early A/B test.
5. **Signature Strength threshold:** 40% is a starting point. May need adjustment based on observed distributions post-launch.
