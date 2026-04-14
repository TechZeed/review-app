# PRD 05: Monetization — Two-Sided Marketplace

**Product:** Every Individual is a Brand  
**Author:** Muthukumaran Navaneethakrishnan  
**Date:** 2026-04-14  
**Status:** Draft  
**Source:** [Brainstorm 2026-04-14, Theme 5](../brainstorms/2026-04-14-review-app-brainstorm.md)

---

## 1. Overview

The monetization model is a two-sided marketplace: individuals use the platform for free, while employers, recruiters, and enterprise HR tech companies pay for access to verified reputation data.

The core asset is a customer-verified reputation profile that no other platform provides. LinkedIn has self-reported skills. Google has business-level reviews. This platform has actual customers attributing specific qualities (Expertise, Care, Delivery, Initiative, Trust) to specific individuals — verified by QR scan, phone OTP, and timestamps. That data is what the paying side of the marketplace buys access to.

**Principle:** The individual is sovereign. They own their profile, control visibility, and benefit from every review regardless of which organization they work for. The organization is a guest on the individual's profile.

---

## 2. Tier Breakdown

### 2.1 Free Forever (Individual)

| Attribute | Detail |
|-----------|--------|
| **Who** | Any frontline worker — retail, hospitality, banking, healthcare, auto sales |
| **Price** | $0, forever |
| **Features** | Personal QR code, public or private profile, collect unlimited reviews, five-quality brand scorecard, text/voice/video reviews from customers, share profile via link, untag/retag organizations freely |
| **Rationale** | The free tier IS the product. Every free user is inventory for the paid side. No artificial limits on reviews or profile features. The more reviews they collect, the more valuable the marketplace becomes. |
| **Conversion lever** | Surface analytics teasers ("You were tagged for Care 47 times this month — upgrade to see trends") |

### 2.2 Pro Individual ($5-10/month)

| Attribute | Detail |
|-----------|--------|
| **Who** | Ambitious frontline workers building a career, job seekers |
| **Price** | $5/month (annual) or $10/month (monthly) |
| **Features** | Full analytics dashboard (quality trends over time, review velocity, peak periods), downloadable reputation report (PDF, shareable), custom QR code designs (branded colors, logo), video highlights reel (auto-curated top video testimonials), priority profile in recruiter search, "Pro" badge on profile |
| **Rationale** | Low price point removes friction. Target is workers who see career value — a $5/month investment that replaces paying for resume services or career coaching. |
| **Key metric** | Free-to-Pro conversion rate |

### 2.3 Employer Dashboard ($50-200/month per location)

| Attribute | Detail |
|-----------|--------|
| **Who** | Store managers, franchise owners, hotel GMs, bank branch managers |
| **Price** | $50/month (single location, <25 employees), $100/month (single location, 25-100 employees), $200/month (single location, 100+ employees). Volume discounts for multi-location: 10+ locations get 20% off, 50+ locations get 35% off. |
| **Features** | Team reputation dashboard (aggregate quality scores across team), individual employee review feeds (with employee consent), top performer identification and leaderboard, retention risk signals (review velocity drops, quality score decline), customer sentiment trends by location, monthly summary reports, "Powered by [App Name]" badge for location marketing |
| **What employers DO NOT get** | They cannot see reviews for employees who haven't consented. They cannot take reviews with them if the employee leaves. They cannot edit, hide, or dispute reviews. The individual remains sovereign. |
| **Rationale** | Positioned as a retention and coaching tool, not a surveillance tool. Employers already pay $200-500/month for mystery shopper programs that give them less actionable data. |

### 2.4 Recruiter Access ($500-1,000/month per seat)

| Attribute | Detail |
|-----------|--------|
| **Who** | Staffing agencies, corporate recruiters, HR departments hiring frontline roles |
| **Price** | $500/month per seat (basic search + view), $1,000/month per seat (search + view + contact + verifiable reference access) |
| **Features** | Search profiles by quality scores, industry, location, review count, and recency. View full profiles of individuals who have opted into recruiter visibility. Contact individuals directly through the platform (InMail equivalent). Access verifiable references (customers who opted in to be contacted). Candidate shortlists and saved searches. Bulk export for ATS integration. |
| **Gating** | Recruiter can ONLY see profiles where the individual has set visibility to "recruiter-visible" or "public." Private profiles are invisible. |
| **Rationale** | LinkedIn Recruiter costs $10,800-15,000/seat/year. This platform offers something LinkedIn cannot: customer-verified quality scores for frontline workers. At $6,000-12,000/seat/year, it undercuts LinkedIn while providing higher-signal data for frontline hiring. |

### 2.5 API/Data (Custom Pricing)

| Attribute | Detail |
|-----------|--------|
| **Who** | Enterprise HR tech platforms (ATS providers, background check companies, workforce management tools) |
| **Price** | Custom — based on API call volume, data scope, and integration depth. Expected range: $2,000-10,000/month. |
| **Features** | REST API for reputation score lookup, quality dimension breakdowns, review count and recency, verification status. Webhook integrations for real-time updates. Batch query endpoints for bulk candidate screening. SDK for common ATS platforms. |
| **Data principles** | API only returns data for individuals who have opted in. No PII without explicit consent. Aggregated/anonymized industry benchmarks available separately. |
| **Rationale** | Long-term revenue diversification. Turns the platform into infrastructure for verified reputation, not just a standalone product. |

---

## 3. Profile Visibility Controls

The individual controls all visibility. This is non-negotiable and core to the "individual is sovereign" principle.

| Setting | Who Can See | Default |
|---------|-------------|---------|
| **Private** | Only the individual. No one else. | YES (default) |
| **Employer-visible** | The individual + their current tagged employer (with consent) | No |
| **Recruiter-visible** | The individual + paying recruiters + tagged employer | No |
| **Public** | Anyone with the profile link or QR code | No |

### Visibility rules

- Default is private. The individual must actively opt in to any broader visibility.
- Changing visibility is instant and reversible.
- Employer visibility requires explicit consent per employer. If an individual untags an employer, that employer loses access immediately.
- Recruiter visibility is a single toggle — the individual does not choose which recruiters see them.
- Public profiles are indexable by search engines (optional — individual can disable indexing while keeping the profile link-shareable).
- Reviews collected while private are retained. If the individual later switches to public, all historical reviews appear.

---

## 4. Competitive Pricing Context

| Competitor | What They Charge | What They Offer | Our Advantage |
|------------|-----------------|-----------------|---------------|
| **LinkedIn Recruiter** | $10,800-15,000/seat/year | Search 930M profiles, InMail, filters | Self-reported data, colleague endorsements. No customer verification. Weak for frontline roles — most frontline workers don't maintain LinkedIn profiles. |
| **Triplebyte** | $7,000+ per hire or 20-25% of first-year salary | Pre-screened technical candidates | Tech-only. No frontline coverage. Pay-per-hire model is expensive for high-volume frontline hiring. |
| **Glassdoor Enhanced Profiles** | Six-figure enterprise contracts | Employer branding on review pages | Reviews are about the company, not individuals. Employer pays to manage perception, not to find talent. |
| **Edge** (startedge.com) | Undisclosed SaaS pricing | Customer-attributed recognition for employees | Recognition stays with the employer. Not portable. Employee leaves, data stays behind. |
| **Indeed/ZipRecruiter** | $5-25 per application (pay-per-click) | Job posting distribution, resume database | Resume-based, no reputation signal. High volume, low signal for frontline quality. |

### Positioning

- For recruiters: "LinkedIn Recruiter for frontline workers, but with customer-verified quality data instead of self-reported skills. At half the price."
- For employers: "Better than mystery shoppers. Real customer feedback on your team, in real time, for a fraction of the cost."
- For individuals: "Free forever. Your reviews travel with you. No employer can take them away."

---

## 5. Revenue Projections Framework

Revenue depends on two funnels: individual adoption (supply side) and paid-tier conversion (demand side).

### Assumptions for Year 1-3 modeling

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Registered individuals | 10,000 | 75,000 | 300,000 |
| Active individuals (1+ review/month) | 3,000 | 25,000 | 120,000 |
| Pro Individual conversion | 2% | 4% | 6% |
| Employer locations | 50 | 400 | 2,000 |
| Recruiter seats | 10 | 80 | 400 |
| API customers | 0 | 2 | 10 |

### Revenue model (conservative estimates)

| Revenue Stream | Year 1 | Year 2 | Year 3 |
|---------------|--------|--------|--------|
| Pro Individual ($7.50 avg/month) | $4,500 | $27,000 | $162,000 |
| Employer Dashboard ($100 avg/month) | $60,000 | $480,000 | $2,400,000 |
| Recruiter Access ($750 avg/month) | $90,000 | $720,000 | $3,600,000 |
| API/Data ($5,000 avg/month) | $0 | $120,000 | $600,000 |
| **Total ARR** | **$154,500** | **$1,347,000** | **$6,762,000** |

### Key drivers

- Recruiter seats and employer dashboards drive 90%+ of revenue in the early years.
- Pro Individual is high volume, low revenue — its primary value is engagement and retention, not revenue.
- API/Data is a Year 2+ play that requires critical mass of profiles.
- Revenue per individual user (blended across all tiers) targets $2-5/year in Year 1, growing to $20+/year by Year 3 as the paid side scales.

---

## 6. Feature Requirements Per Tier

### 6.1 Free Forever

| Feature | Priority | Notes |
|---------|----------|-------|
| QR code generation (unique per individual) | P0 | Must work offline (printable). Regenerable if compromised. |
| Profile page (name, photo, tagged org, quality scores, reviews) | P0 | Mobile-first. Loads in <2 seconds. |
| Collect reviews (text, voice, video) | P0 | No limit on review count. |
| Five-quality scorecard display | P0 | Aggregated from all reviews. Visual heat map of strengths. |
| Share profile via link | P0 | Shareable URL, embeddable badge. |
| Org tagging/untagging | P0 | Individual can tag current employer, untag when they leave. |
| Visibility toggle (private/public) | P0 | Default private. |
| Basic review notifications | P1 | Push/email when a new review is received. |

### 6.2 Pro Individual

All Free features, plus:

| Feature | Priority | Notes |
|---------|----------|-------|
| Analytics dashboard | P0 | Quality trends (weekly/monthly), review velocity, top qualities over time. |
| Downloadable reputation report (PDF) | P0 | Formatted for job applications. Includes QR to verify online. |
| Custom QR code designs | P1 | Color themes, logo overlay, branded templates. |
| Video highlights reel | P1 | Auto-curated from top-rated video reviews. Shareable. |
| Priority in recruiter search | P1 | Pro profiles rank higher in search results (disclosed to recruiter). |
| "Pro" badge on profile | P2 | Visual indicator of Pro status. |
| Recruiter-visible toggle | P0 | Only available in Pro tier. |

### 6.3 Employer Dashboard

| Feature | Priority | Notes |
|---------|----------|-------|
| Team overview (all consented employees at a location) | P0 | Aggregate scores, individual drill-down. |
| Employee consent management | P0 | Employees must opt in. Dashboard shows consent status. |
| Top performer leaderboard | P0 | Ranked by quality scores, review volume, or specific qualities. |
| Retention risk alerts | P1 | Flag employees with declining review velocity or scores. |
| Customer sentiment trends | P1 | Quality score trends per location over time. |
| Monthly summary reports (email + PDF) | P1 | Auto-generated, sent to location manager. |
| Multi-location roll-up view | P1 | For multi-location employers on volume plans. |
| Employee onboarding flow | P2 | Invite employees, generate QR codes, training materials. |

### 6.4 Recruiter Access

| Feature | Priority | Notes |
|---------|----------|-------|
| Search by quality scores | P0 | Filter by minimum scores in specific qualities. |
| Search by industry, location, review count | P0 | Standard search filters. |
| Profile view (full detail for opted-in individuals) | P0 | Quality breakdown, review samples, verification status. |
| Contact via platform messaging | P0 | InMail-style messaging. Rate-limited to prevent spam. |
| Verifiable reference access (premium tier) | P0 | View and contact customers who opted in to verify. |
| Saved searches and candidate shortlists | P1 | Persistent searches with new-match notifications. |
| ATS export (CSV, API) | P1 | Standard formats for major ATS platforms. |
| Search result analytics | P2 | Conversion rates on outreach, response rates. |

### 6.5 API/Data

| Feature | Priority | Notes |
|---------|----------|-------|
| REST API (reputation score lookup) | P0 | By individual ID or lookup key. Returns scores, review count, verification level. |
| Webhook integration | P1 | Push notifications on profile updates, new reviews. |
| Batch query endpoint | P1 | Bulk lookups for screening workflows. |
| Anonymized industry benchmarks | P2 | Aggregate quality scores by industry, role, region. |
| SDK (Python, Node, Java) | P2 | Wrapper libraries for common ATS platforms. |

---

## 7. User Stories

### 7.1 Individual (Free)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| I-1 | As an individual, I want to generate a personal QR code so customers can review me directly. | QR code links to my profile. Printable. Works on any phone camera. |
| I-2 | As an individual, I want my reviews to stay with me when I leave my job. | Untagging an employer does not delete any reviews. All historical reviews persist. |
| I-3 | As an individual, I want to control who sees my profile. | I can toggle between private, employer-visible, recruiter-visible, and public at any time. |
| I-4 | As an individual, I want to see which qualities customers highlight most. | Profile shows aggregated quality scores from all reviews. |

### 7.2 Individual (Pro)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| IP-1 | As a Pro individual, I want to see how my reputation trends over time. | Dashboard shows weekly/monthly quality score trends with charts. |
| IP-2 | As a Pro individual, I want a downloadable report I can attach to job applications. | PDF report with quality scores, review highlights, and verification QR code. |
| IP-3 | As a Pro individual, I want recruiters to find me based on my customer reviews. | My profile appears in recruiter search results when I enable recruiter visibility. |

### 7.3 Employer

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| E-1 | As an employer, I want to see my team's customer reputation at a glance. | Dashboard shows all consented employees with quality scores and review counts. |
| E-2 | As an employer, I want to identify top performers for recognition or promotion. | Leaderboard ranks employees by configurable criteria (overall score, specific quality, review count). |
| E-3 | As an employer, I want early warning when a strong performer might be disengaging. | Alert triggered when an employee's review velocity drops >40% month-over-month or quality scores decline for 3+ consecutive weeks. |
| E-4 | As an employer, I want to use customer reviews as coaching data. | Individual drill-down shows review text/voice/video with quality tags, filterable by date and quality. |

### 7.4 Recruiter

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| R-1 | As a recruiter, I want to find frontline workers with proven customer-service skills. | Search by quality scores (e.g., "Care > 4.0, Trust > 4.0"), industry, location, and minimum review count. |
| R-2 | As a recruiter, I want to verify that a candidate's reputation is real, not fabricated. | Profile shows verification level (QR scan, phone OTP, location, video reviews). Verifiable references are contactable. |
| R-3 | As a recruiter, I want to contact candidates directly. | In-platform messaging. Candidate receives notification. Rate limit: 50 contacts/month on basic, 200/month on premium. |
| R-4 | As a recruiter, I want to export shortlisted candidates to my ATS. | CSV export with profile link, quality scores, review count, verification level. API export for integrated ATS. |

---

## 8. Success Metrics

### 8.1 Supply Side (Individuals)

| Metric | Target (Year 1) | Target (Year 3) |
|--------|-----------------|-----------------|
| Registered individuals | 10,000 | 300,000 |
| Monthly active (1+ review received) | 30% of registered | 40% of registered |
| Profiles with 10+ reviews | 15% of active | 35% of active |
| Profiles with video reviews | 5% of active | 15% of active |
| Free-to-Pro conversion | 2% | 6% |
| Pro monthly churn | <8% | <5% |

### 8.2 Demand Side (Employers + Recruiters)

| Metric | Target (Year 1) | Target (Year 3) |
|--------|-----------------|-----------------|
| Employer locations | 50 | 2,000 |
| Employer monthly churn | <5% | <3% |
| Employer NPS | >40 | >50 |
| Recruiter seats | 10 | 400 |
| Recruiter monthly churn | <8% | <5% |
| Recruiter search-to-contact rate | >10% | >15% |
| Recruiter contact-to-response rate | >20% | >30% |

### 8.3 Revenue

| Metric | Target (Year 1) | Target (Year 3) |
|--------|-----------------|-----------------|
| ARR | $150K+ | $6M+ |
| ARPU — Pro Individual | $90/year | $90/year |
| ARPU — Employer location | $1,200/year | $1,200/year |
| ARPU — Recruiter seat | $9,000/year | $9,000/year |
| Blended revenue per registered individual | $15/year | $22/year |
| LTV:CAC ratio (employer) | >3:1 | >5:1 |
| LTV:CAC ratio (recruiter) | >3:1 | >5:1 |

### 8.4 Platform Health

| Metric | Target |
|--------|--------|
| Review completion rate (QR scan to submitted review) | >60% |
| Review fraud rate (flagged by anti-fraud stack) | <2% |
| Average reviews per active individual per month | >3 |
| Recruiter-visible profiles (% of total) | >15% by Year 2 |

---

## 9. Risks and Mitigations

### 9.1 Pricing Sensitivity

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pro Individual price too high for frontline workers | Medium | Low (Pro revenue is small) | Start at $5/month. Offer annual discount. Consider employer-sponsored Pro upgrades. |
| Employer dashboard too expensive for small businesses | Medium | High | $50/month entry tier for <25 employees. Free 30-day trial. ROI calculator showing cost vs. mystery shopper programs. |
| Recruiter price perceived as too low (credibility risk) | Low | Medium | Position against LinkedIn Recruiter pricing. Emphasize unique data (customer-verified) that LinkedIn lacks. |

### 9.2 Free-Tier Abuse

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Individuals gaming reviews (scanning own QR, asking friends) | High | Critical | Five-layer anti-fraud stack (QR scan proof, phone OTP, time-window tokens, AI pattern detection, video/voice trust signals). One phone = one review per individual per time window. |
| Employers scraping free profiles instead of paying for dashboard | Medium | Medium | Free profiles show limited data (top-line scores only). Dashboard provides trends, alerts, leaderboards, and coaching tools that cannot be scraped. |
| Recruiters creating fake free profiles to browse | Low | Low | Profile creation requires phone verification. Recruiter search is a gated feature — browsing public profiles shows limited info without a paid seat. |

### 9.3 Marketplace Chicken-and-Egg

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Not enough profiles to attract recruiters | High | Critical | Launch in one metro area, one industry (e.g., auto dealerships in a single city). Reach critical mass locally before expanding. Employer dashboard revenue can sustain the business before recruiter revenue kicks in. |
| Not enough recruiter demand to justify Pro upgrades | Medium | Low | Pro value is primarily the reputation report and analytics, not recruiter visibility. Recruiter visibility is a bonus, not the core Pro value prop. |

### 9.4 Individual Trust

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Individuals fear employer surveillance | High | High | Private by default. Employer sees nothing without explicit consent. Marketing emphasizes sovereignty. Consent is granular and revocable. |
| Individuals don't understand the value of opting into recruiter visibility | Medium | Medium | In-app education: "X recruiters searched for people with your quality scores this month." Show demand signal before asking for opt-in. |

### 9.5 Competitive Response

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LinkedIn adds customer review features | Low (near-term) | High (long-term) | LinkedIn's business model requires employer data ownership. Individual sovereignty is philosophically incompatible with their enterprise sales model. Move fast, build network effects. |
| Edge makes reviews portable | Medium | Medium | Edge's existing customers (employers) would resist portability — it reduces their leverage. Portability is hard to retrofit when the business model depends on employer lock-in. |
| Google expands reviews to individuals | Low | High | Google reviews are anonymous and unverified. The QR-scan + phone OTP + video verification stack creates a fundamentally different trust level. |

---

## 10. Implementation Priorities

### Phase 1 (MVP — Month 1-3)
- Free tier: QR code, profile, review collection (text only), quality scorecard, visibility toggle
- Basic anti-fraud (QR scan + phone OTP + time-window tokens)
- Single-location employer dashboard (basic — team view, scores)

### Phase 2 (Month 4-6)
- Voice and video reviews
- Pro Individual tier (analytics, reputation report)
- Employer dashboard enhancements (leaderboard, trends)
- Recruiter Access (search, profile view, messaging)

### Phase 3 (Month 7-12)
- Verifiable references integration
- Multi-location employer roll-up
- API/Data tier (beta)
- Custom QR codes, video highlights reel
- AI pattern detection (anti-fraud Layer 4)

---

## Appendix: Pricing Decision Log

| Decision | Rationale | Revisit Trigger |
|----------|-----------|----------------|
| Individual free forever | Supply-side liquidity is existential. Any paywall on basic features kills adoption. | Never — this is a core principle. |
| Pro at $5-10/month, not $15-20 | Frontline workers earn $15-25/hour. $5/month is one latte. $20/month feels like a subscription they'll cancel. | If free-to-Pro conversion exceeds 10%, test higher pricing. |
| Employer at $50-200/month per location | Undercuts mystery shopper programs ($500+/month). Low enough to be a department-level purchase, not a C-suite decision. | If employer churn is <2%, test price increases. |
| Recruiter at $500-1,000/month per seat | 50-60% cheaper than LinkedIn Recruiter. Justified by unique data (customer-verified). | If recruiter churn is <3% and waitlist forms, increase pricing. |
| API custom pricing | Market is too nascent to set fixed pricing. Need to discover willingness-to-pay through early deals. | After 5 API customers, standardize pricing tiers. |
