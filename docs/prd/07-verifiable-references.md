# PRD 07: Verifiable References

**Status:** Draft
**Date:** 2026-04-14
**Author:** Muthukumaran Navaneethakrishnan
**Brainstorm Source:** Ideas #47, #48, #49, #50

---

## Overview

Traditional hiring references are broken: candidates hand-pick 3 ex-managers who deliver rehearsed, predictable endorsements. The employer has no way to verify whether the reference is genuine, relevant, or representative.

Verifiable References turns every customer review into a portable, verifiable reference. When a customer leaves a review, they can optionally consent to be contacted by a future employer or recruiter to verify that review. This creates an unbreakable chain of proof: QR scan (physical presence) + timestamp + location + phone verification + customer consent.

The result: an individual's profile accumulates real, contactable references from actual customers over time -- not 3 hand-picked managers, but N genuine customer endorsements that a recruiter can independently verify.

This is the killer feature because it bridges the gap between "review platform" and "verified professional credential."

---

## Customer Opt-In Flow

### When Opt-In Happens

The opt-in prompt appears **after** the customer completes their review (quality taps + thumbs up + optional media). It is never shown before or during the review -- the review must feel complete and low-friction first.

### Opt-In Screen

After submitting the review, the customer sees a single screen:

> **Would you vouch for [Name] to a future employer?**
>
> If you say yes, a potential employer may contact you through our platform to verify this review. Your phone number and personal details are never shared directly.
>
> [ Yes, I'd vouch for them ] [ No thanks ]

### Opt-In Rules

- Opt-in is always optional. Never pre-checked, never required, never incentivized.
- The customer can withdraw consent at any time from a simple link in any verification-related communication.
- Opt-in applies to that specific review only, not to all future reviews from that customer.
- The customer's decision (yes or no) is never visible to the individual being reviewed.
- No financial or platform incentive is offered for opting in. This must remain a genuine endorsement.

---

## "Verifiable" Badge System

### Badge Display

Reviews where the customer opted in display a **"Verifiable"** badge. This badge is visible on:

- The individual's public profile
- The review detail view
- The recruiter search results (for paid recruiter accounts)
- Exported reputation reports (Pro tier)

### Badge Tiers

| Badge | Criteria | Display |
|-------|----------|---------|
| **Verified Interaction** | QR scan + timestamp + location + phone OTP | Confirms a real in-person interaction occurred |
| **Verifiable** | Verified Interaction + customer opted in to be contacted | Confirms the review can be independently verified by a third party |
| **Verified Testimonial** | Verifiable + video or voice review attached | Highest trust signal -- contactable customer with rich media proof |

### Badge Integrity

- Badges are system-assigned based on data. Neither the individual nor the customer can manually request or alter badge status.
- If a customer withdraws consent, the "Verifiable" badge is removed. The review itself remains, and any "Verified Interaction" badge stays.
- Badge status is recalculated if underlying data changes (e.g., customer withdraws, phone number becomes invalid).

---

## The Verified Chain

Each verifiable review carries a cryptographic proof chain:

```
QR Scan
  |-- Timestamp: 2026-04-14T14:32:07Z
  |-- Location: 12.9716, 77.5946 (if permitted)
  |-- Device fingerprint: hashed, non-PII
  |
Phone Verification
  |-- OTP sent to customer's phone
  |-- One phone = one review per individual per time window
  |
Customer Consent
  |-- Explicit opt-in recorded with timestamp
  |-- Consent ID: unique, immutable reference
  |-- Withdrawal mechanism: active at all times
```

### What the Chain Proves

1. **Physical presence** -- the customer was physically near the individual (QR scan + location)
2. **Temporal proximity** -- the review happened within 24-48 hours of the interaction (time-window token)
3. **Real person** -- a verified phone number is attached (OTP)
4. **Willingness to vouch** -- the customer explicitly agreed to be contacted (consent)

No traditional reference system provides even one of these proof layers. This chain provides all four.

---

## Comparison: Traditional References vs. Verifiable References

| Dimension | Traditional Hiring References | Verifiable References |
|-----------|------------------------------|----------------------|
| **Source** | 3 hand-picked ex-managers | N real customers who interacted with the individual |
| **Selection bias** | Candidate picks their best advocates | Customers self-select to opt in; candidate has no control over who opts in |
| **Authenticity** | Rehearsed, often formulaic | Raw customer perspective; video/voice adds emotion and specificity |
| **Verification** | Employer calls a phone number the candidate provided -- no proof the person is who they claim | Platform-mediated contact; identity verified via OTP at time of review |
| **Volume** | Static -- same 3 people for years | Grows over time -- new references accumulate with every job |
| **Relevance** | Manager perspective on internal work | Customer perspective on service delivery -- directly relevant for frontline roles |
| **Portability** | Candidate must re-collect references at every job change | References are permanently attached to the individual's profile |
| **Fraud resistance** | Easy to fake (friend poses as manager) | QR scan + location + timestamp + OTP + consent = multi-layer proof |
| **Recency** | References may be years old | Continuous -- most recent interactions are always visible |

---

## Recruiter/Employer Verification Flow (Privacy-Preserving)

### How a Recruiter Contacts a Verified Reviewer

Recruiters never receive the customer's phone number, email, or personal details. All contact flows through the platform.

**Step 1: Recruiter finds a candidate profile**
- Recruiter (paid seat) browses or searches profiles by quality scores, industry, location.
- Verifiable reviews are highlighted with badges.

**Step 2: Recruiter requests verification**
- Recruiter clicks "Request Verification" on a specific verifiable review.
- Recruiter submits: their name, company, role they are hiring for, and a brief message (max 300 characters).

**Step 3: Platform notifies the customer**
- The platform sends the customer a notification (SMS or in-app push, based on customer preference).
- The notification includes: recruiter's name, company, role, and message. It does NOT include the individual's name to prevent social engineering.
- The customer sees: "A recruiter from [Company] hiring for [Role] would like to verify a review you left. Would you like to respond?"

**Step 4: Customer responds (or doesn't)**
- Customer can: accept (connect via platform messaging), decline, or ignore.
- If accepted: a time-limited, anonymized chat channel opens between the recruiter and customer. No personal contact info is exchanged.
- If declined or ignored: recruiter is told "The reviewer chose not to respond at this time." No further detail.

**Step 5: Conversation and closure**
- Chat channel expires after 7 days or when either party closes it.
- The customer can permanently withdraw verification consent from this screen at any time.

### Rate Limits

- A recruiter can request verification on a maximum of 5 reviews per candidate profile per month.
- A customer receives a maximum of 3 verification requests per month across all reviews. Excess requests are queued.
- A customer who has not responded to the last 3 requests is temporarily marked as "Verifiable (unresponsive)" -- badge remains, but recruiters see reduced likelihood of response.

---

## Customer Privacy Protections

### Core Principles

1. **Opt-in only.** Consent is never assumed, pre-checked, or bundled with the review action.
2. **Withdraw anytime.** Every verification-related communication includes a one-tap withdrawal link.
3. **No direct contact sharing.** The platform never shares the customer's phone number, email, or name with recruiters or the individual.
4. **Anonymized channel.** Verification conversations use platform-generated identifiers ("Verified Customer #4827"), not real names.
5. **No retaliation path.** The individual being reviewed never knows which customers opted in, which declined, or which were contacted.

### Data Handling

| Data Point | Stored? | Shared with Recruiter? | Shared with Individual? |
|------------|---------|----------------------|------------------------|
| Customer phone number | Yes (encrypted, for OTP and notification) | No | No |
| Customer name | Yes (encrypted) | No (anonymized identifier used) | No |
| Review content | Yes | Yes (visible on profile) | Yes |
| Opt-in status | Yes | Yes (via badge) | No (only aggregate count shown) |
| Consent timestamp | Yes | No | No |
| Verification conversation | Yes (retained 90 days, then deleted) | Yes (during active channel) | No |

### Withdrawal Process

- Customer taps "Withdraw" from any notification or from their review history.
- Effect is immediate: "Verifiable" badge removed, pending verification requests cancelled, no future requests routed.
- The review itself is unaffected. The customer can also delete the review separately if desired.
- Withdrawal is permanent for that review. The customer would need to leave a new review to opt in again.

---

## Feature Requirements

### P0 (Launch Blockers)

| ID | Requirement | Detail |
|----|-------------|--------|
| VR-01 | Opt-in prompt post-review | Single screen after review submission. Binary choice. No dark patterns. |
| VR-02 | Consent storage | Immutable consent record: review ID, customer ID, timestamp, consent version, IP. |
| VR-03 | "Verifiable" badge rendering | Badge displayed on profile, review detail, and search results. |
| VR-04 | Withdrawal mechanism | One-tap withdrawal from any notification. Immediate badge removal. |
| VR-05 | Privacy-preserving contact flow | Anonymized messaging channel between recruiter and customer. No PII exchange. |
| VR-06 | Rate limiting | Enforce per-recruiter and per-customer request caps. |
| VR-07 | Consent audit trail | Full log of consent grants, withdrawals, and verification requests for compliance. |

### P1 (Fast Follow)

| ID | Requirement | Detail |
|----|-------------|--------|
| VR-08 | Verification response analytics | Recruiter dashboard: response rate, average response time per candidate. |
| VR-09 | "Verified Testimonial" badge | Auto-awarded when verifiable review includes video or voice media. |
| VR-10 | Bulk verification requests | Recruiter can request verification on up to 3 reviews per candidate in one action. |
| VR-11 | Customer notification preferences | Customer chooses SMS, push, or email for verification requests. |
| VR-12 | Reputation report integration | Verifiable review count and badge breakdown included in Pro tier exported reports. |

### P2 (Future)

| ID | Requirement | Detail |
|----|-------------|--------|
| VR-13 | Employer API access | Programmatic verification request via API for ATS integration. |
| VR-14 | Verification attestation document | Downloadable PDF summarizing verified chain for a specific review. |
| VR-15 | Multi-language verification flow | Verification request and response in customer's preferred language. |

---

## User Stories

### Customer Opting In

**As a customer** who just had a great experience with a service professional, **I want to** indicate that I am willing to vouch for them to a future employer, **so that** my positive experience can help them in their career.

- I complete my review (tap qualities, thumbs up, optional voice note).
- I see a clear, low-pressure prompt asking if I would vouch for this person.
- I tap "Yes" and I am done. No additional steps, no forms, no account creation required.
- I know I can change my mind later.

### Customer Withdrawing

**As a customer** who previously opted in to verify a review, **I want to** withdraw my consent easily, **so that** I am no longer contacted about this review.

- I tap "Withdraw" from a notification or my review history.
- I see immediate confirmation that my consent is removed.
- I stop receiving verification requests for this review.

### Recruiter Verifying

**As a recruiter** evaluating a candidate for a frontline role, **I want to** contact real customers who reviewed the candidate, **so that** I can independently verify the candidate's service quality before making a hiring decision.

- I find the candidate's profile and see reviews with "Verifiable" badges.
- I click "Request Verification" and provide my context (company, role, brief message).
- I receive a response (or non-response) within a reasonable timeframe.
- If the customer accepts, I can ask follow-up questions via an anonymized chat.
- I never see the customer's real name or contact details.

### Individual Showcasing Verifiable References

**As a frontline professional** looking for a new job, **I want to** highlight that my reviews are independently verifiable, **so that** prospective employers trust my reputation profile more than a traditional resume.

- My profile shows a count of verifiable reviews prominently.
- I can share my profile link or QR code with prospective employers.
- I do not know which specific customers opted in -- only the count.
- My verifiable references grow automatically as I collect more reviews with opt-ins.

---

## Success Metrics

### Primary Metrics

| Metric | Definition | Target (6-month post-launch) |
|--------|-----------|------------------------------|
| **Opt-in rate** | % of completed reviews where customer opts in to be contactable | 15-25% |
| **Verification request rate** | # of verification requests per recruiter seat per month | 8-15 requests/seat/month |
| **Verification response rate** | % of verification requests where customer accepts and responds | 40-60% |
| **Hire conversion uplift** | % increase in hire rate for candidates with 3+ verifiable reviews vs. candidates without | 20-30% uplift |

### Secondary Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Consent withdrawal rate** | % of opt-ins that are later withdrawn | < 10% |
| **Time to response** | Median time from verification request to customer response | < 48 hours |
| **Recruiter retention** | % of recruiter seats renewed after first quarter | > 70% |
| **Verifiable review share** | % of all reviews on the platform that carry "Verifiable" badge | 15-20% |
| **Verified Testimonial share** | % of verifiable reviews that also include video/voice | 5-10% |

### Leading Indicators

- Opt-in prompt impression-to-tap ratio (measures prompt effectiveness)
- Recruiter search-to-verification-request ratio (measures perceived value)
- Customer satisfaction with verification process (post-interaction survey, NPS)

---

## Legal and Compliance Considerations

### Consent Framework

- **GDPR (EU/EEA):** Customer consent for verification contact constitutes processing of personal data for a specific purpose. Consent must be freely given, specific, informed, and unambiguous (Article 7). Withdrawal must be as easy as giving consent. Record of consent required.
- **CCPA (California):** Customer has right to know what data is collected, right to delete, and right to opt out of sale. Verification data must not be classified as "sold" -- it is used to facilitate a service the customer requested.
- **TCPA (US):** SMS notifications for verification requests require prior express consent. The opt-in to "be contacted" covers platform-initiated SMS for verification purposes. Include opt-out in every message.
- **PDPA / local equivalents:** For markets outside US/EU, map consent and withdrawal flows to local data protection requirements before launch.

### Data Retention

- Consent records: retained for the lifetime of the review + 3 years after withdrawal (legal defensibility).
- Verification chat transcripts: retained 90 days after channel closure, then permanently deleted.
- Customer contact data (phone, hashed device info): retained while consent is active. Anonymized 30 days after withdrawal.

### Terms of Service Requirements

- Clear language in ToS covering: what "verifiable" means, what the customer is agreeing to, how their data is used, how to withdraw.
- Separate consent flow for verification (not bundled into app-wide ToS acceptance).
- Age restriction: verification opt-in available only to customers 18+.

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Customer harassment via repeated requests | Rate limits (3 requests/month per customer). Auto-block after 3 ignored requests. |
| Recruiter impersonation | Recruiter accounts require company email verification and paid subscription. |
| Customer coercion by the individual | Individual never sees who opted in. Opt-in screen appears after the individual interaction is complete. |
| Data breach exposing customer contact info | Phone numbers encrypted at rest (AES-256). Anonymized identifiers used in all external-facing flows. |
| Regulatory action for insufficient consent | Consent audit trail with timestamps, version tracking, and withdrawal records. Annual legal review of consent language. |

---

## Dependencies

- **Theme 6 (Trust & Anti-Fraud):** The verified chain layers (QR, OTP, timestamp, location) must be operational before verifiable references can launch. Verifiable References sits on top of the anti-fraud stack.
- **Theme 5 (Monetization):** Recruiter seat tier must be live for the verification contact flow to function. Free-tier users cannot initiate verification requests.
- **Theme 4 (Rich Media):** Video/voice review infrastructure required for the "Verified Testimonial" badge tier.
- **Infrastructure:** Anonymized messaging system, SMS/push notification service, encrypted consent storage.
