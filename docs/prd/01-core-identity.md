# PRD 01: Core Identity -- "Every Individual is a Brand"

**Status:** Draft
**Date:** 2026-04-14
**Author:** Muthukumaran Navaneethakrishnan
**Source:** [Brainstorm 2026-04-14](../brainstorms/2026-04-14-review-app-brainstorm.md) -- Theme 1 (Ideas #1, #2, #3c, #10, #12, #13, #34, #35, #36)

---

## 1. Overview & Vision

The app makes frontline individuals -- salespeople, nurses, hotel staff, bank RMs -- the owners of their professional reputation. Today, customer recognition flows to the org ("5 stars for XYZ Dealership"), not the person who delivered the experience. This product inverts that: the individual owns the profile, the org is a guest, and the reputation is portable forever.

**Positioning anchor:** "Every individual is a brand." Your profile is what customers say about you, not what you claim about yourself.

**Anti-LinkedIn thesis:** LinkedIn profiles are self-reported. Manager references are secondhand. This app surfaces the one signal that matters most for frontline roles: direct customer proof.

---

## 2. Problem Statement

### 2.1 The Attribution Gap

Reviews go to the business entity (Google review for "XYZ Dealership"), not the person ("Ramesh who helped me"). The individual who created the positive experience is invisible in the org's aggregate rating.

- Customers cannot direct praise to a specific person in any existing review system.
- High performers are indistinguishable from average performers in public perception.

### 2.2 The Proof Gap

No verifiable, customer-sourced credential exists for frontline individuals.

- Resumes are self-reported.
- Manager references are secondhand and subjective.
- The customer who experienced the value firsthand has no structured channel to vouch for the individual.
- When the individual changes jobs, any informal recognition disappears entirely.

### 2.3 The Customer Advocacy Gap

Customers want to publicly back the person, not just the company. There is no platform where saying "this human was exceptional" permanently attaches to that individual's professional identity.

- Customers currently have no outlet beyond telling a manager (high friction) or leaving an org-level Google/Yelp review (wrong target).
- The intent to advocate exists -- the channel does not.

---

## 3. User Personas

### 3.1 Frontline Worker (Primary User)

**Examples:** Car salesperson, hotel concierge, bank relationship manager, nurse, retail associate, restaurant server.

**Needs:**
- Own a professional profile that reflects actual customer experience, not self-reported claims.
- Carry reputation across job changes -- reviews must not stay locked to an employer.
- Share proof of quality with potential employers without relying on manager references.
- Low-effort setup -- profile creation must take under 2 minutes.

**Pain today:** "I was the top-rated salesperson at my last dealership, but I have zero proof. My new employer has no idea."

### 3.2 Customer (Review Giver)

**Examples:** Car buyer, hotel guest, bank client, patient, retail shopper.

**Needs:**
- A fast, frictionless way to recognize the specific person who helped them.
- Confidence that the recognition actually reaches and stays with that person.
- Optional ability to leave richer feedback (voice, video, text) if motivated.

**Pain today:** "I want to thank the person who helped me, but the Google review just goes to the dealership."

### 3.3 Employer (Dashboard Consumer)

**Examples:** Dealership manager, hotel GM, bank branch manager, hospital department head.

**Needs:**
- Visibility into which team members are receiving customer praise.
- Retention signals -- identify top performers before they leave.
- Team-level reputation data without owning or controlling individual profiles.

**Pain today:** "I find out my best salesperson was great only after they leave and customers ask for them."

### 3.4 Recruiter (Profile Consumer)

**Examples:** Staffing agency recruiter, HR manager hiring frontline roles.

**Needs:**
- Search and discover individuals by customer-verified quality scores.
- Access verifiable references from actual customers, not hand-picked manager contacts.
- Filter by industry, location, and specific quality strengths.

**Pain today:** "I'm hiring 20 bank tellers. Resumes all look the same. I have no way to identify who actually delivers great customer experience."

---

## 4. Core Principles

### 4.1 Individual Sovereignty

The individual creates and owns their profile independently. No employer approval, no org-gated access. The profile exists because the person exists, not because they work somewhere.

- The individual controls what is visible and to whom.
- Profile data (reviews, qualities, testimonials) belongs to the individual, not any org.
- Deleting an org association does not delete any reviews received during that period.

### 4.2 Portable Reputation

Reviews, quality scores, and testimonials travel with the individual permanently. Changing jobs, industries, or cities does not reset reputation.

- Reviews are timestamped and associated with the individual's profile, not the org.
- Historical reviews remain accessible and visible regardless of employment status.
- The profile is a cumulative, lifelong asset.

### 4.3 Organization as Guest

An employer can tag themselves onto an individual's profile ("Ramesh works at ABC Dealership"). This gives the org visibility and dashboard access. But the individual controls the profile. The org is a guest, not the owner.

- Org tagging requires individual consent.
- The individual can untag the org at any time (e.g., upon leaving).
- Untagging removes the org's dashboard access but does not affect reviews or profile content.
- The org cannot edit, hide, or delete any review on the individual's profile.

---

## 5. Feature Requirements

### 5.1 Profile Creation

| Requirement | Detail |
|-------------|--------|
| **Self-service signup** | Individual creates account with phone number or email. No employer involvement required. |
| **Basic profile fields** | Name, photo, industry/role (optional), short bio (optional). |
| **Time to create** | Under 2 minutes from start to shareable profile. |
| **No employer prerequisite** | Profile exists independently. Org association is optional and added later. |
| **Profile visibility control** | Individual sets profile to public, recruiter-visible only, or private. Default: private. |

### 5.2 QR Code Ownership

| Requirement | Detail |
|-------------|--------|
| **Personal QR code** | Generated at signup. Unique to the individual, not the org. |
| **Always accessible** | Available in-app for display on phone, printable for badge/business card. |
| **Portable across jobs** | Same QR code works regardless of current employer. URL and code do not change when org association changes. |
| **Scan behavior** | Scanning the QR opens the individual's profile and review flow directly. No app download required for the reviewer (web-based). |
| **Customization (future)** | Pro tier: custom QR designs, branded colors. Free tier: standard design. |

### 5.3 Organization Tagging / Untagging

| Requirement | Detail |
|-------------|--------|
| **Org tags individual** | Employer sends a tag request. Individual accepts or rejects. |
| **Individual tags org** | Individual can also initiate by searching for and selecting their employer. Org confirms. |
| **Active tag display** | Current org name and role displayed on profile (e.g., "Sales Associate at ABC Dealership"). |
| **Untag on departure** | Individual untags org when they leave. One-tap action. |
| **Untag effect** | Org loses dashboard access to this individual's future reviews. Historical reviews remain on the individual's profile with the org name as context (e.g., "while at ABC Dealership"). |
| **Multiple orgs** | Support for concurrent org associations (e.g., part-time at two locations). |
| **Org cannot force-remove profile** | Org can untag themselves, but cannot delete the individual's profile or reviews. |

### 5.4 Profile Portability

| Requirement | Detail |
|-------------|--------|
| **Lifetime persistence** | Profile and all associated data persist indefinitely regardless of employment changes. |
| **Shareable link** | Permanent URL (e.g., app.com/ramesh) that the individual can share on resumes, LinkedIn, email signatures. |
| **Data export** | Individual can export their profile data (reviews, scores, testimonials) in a standard format (PDF report, JSON). |
| **No org lock-in** | No feature of the product should create dependency on a specific employer for profile value. |
| **Cross-industry continuity** | A nurse who becomes a pharmaceutical sales rep carries their Care and Trust scores forward. The profile is role-agnostic at the data level. |

---

## 6. User Stories

### Frontline Worker

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| FW-1 | As a frontline worker, I can create a profile in under 2 minutes so that I can start collecting customer reviews immediately. | Signup flow completes in under 2 minutes. QR code is generated and accessible at the end of signup. |
| FW-2 | As a frontline worker, I can display my QR code on my phone or print it for my badge so that customers can scan it after an interaction. | QR code is viewable full-screen in-app. QR code is downloadable as an image for printing. |
| FW-3 | As a frontline worker, I can associate my profile with my current employer so that they can see my customer reviews on their dashboard. | I can search for my employer and send a tag request. I receive confirmation when the tag is active. |
| FW-4 | As a frontline worker, I can untag my employer when I leave so that they no longer have dashboard access to my new reviews. | One-tap untag action. All prior reviews remain on my profile. Org dashboard access is revoked for future reviews. |
| FW-5 | As a frontline worker, I can share my profile link on my resume or LinkedIn so that potential employers can see my customer-verified reputation. | Permanent shareable URL exists. URL does not change when I change employers. |
| FW-6 | As a frontline worker, I can control who sees my profile (public, recruiters only, private) so that I manage my own visibility. | Privacy setting is accessible in profile settings. Changes take effect immediately. |
| FW-7 | As a frontline worker, I can export my reviews and scores as a PDF so that I can attach proof of reputation to job applications. | PDF export includes all reviews, quality scores, and timestamps. Export is available from profile settings. |

### Customer

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| CU-1 | As a customer, I can scan a QR code and leave a review in under 10 seconds so that it does not feel like a chore. | QR scan opens review flow in mobile browser. Minimum viable review (tap qualities + thumbs up) completes in under 10 seconds. No app download required. |
| CU-2 | As a customer, I can see that my review is attached to the specific person who helped me so that I know my recognition reaches the right individual. | After submitting, confirmation screen shows the individual's name and photo. |

### Employer

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| EM-1 | As an employer, I can tag my team members so that I can see their customer reviews in my dashboard. | I can send tag requests to individuals. Dashboard populates with reviews for tagged individuals. |
| EM-2 | As an employer, I understand that I cannot edit or delete reviews on my team members' profiles. | No edit/delete controls exist for individual reviews in the employer dashboard. |

### Recruiter

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| RC-1 | As a recruiter, I can view a candidate's customer-verified profile when they share their link so that I can assess their frontline reputation. | Shared profile link displays quality scores, review count, and testimonials (if profile is set to public or recruiter-visible). |

---

## 7. Success Metrics

### Activation

| Metric | Target | Rationale |
|--------|--------|-----------|
| Profile creation completion rate | > 80% | Signup flow must be fast enough that most who start will finish. |
| Time to first QR display | < 3 minutes from signup start | The value prop (scannable QR) must be immediately available. |
| Profiles with at least 1 review within 7 days | > 40% | Early review collection validates the QR-to-review loop works. |

### Engagement

| Metric | Target | Rationale |
|--------|--------|-----------|
| Reviews per active profile per month | > 3 | Indicates the individual is actively using their QR and customers are responding. |
| Profile share rate (link shared externally) | > 20% of active profiles | Proves individuals see the profile as a portable asset worth sharing. |
| Org tag adoption rate | > 50% of active profiles | Validates that the org-as-guest model is accepted and used. |

### Portability

| Metric | Target | Rationale |
|--------|--------|-----------|
| Profile retention after job change | > 90% | The core promise: reputation survives job transitions. |
| Reviews retained after org untag | 100% | Non-negotiable. Zero reviews should be lost on untag. |
| Profiles with 2+ historical org associations | Track (no target) | Leading indicator that portability is real and being used. |

### Reputation Compound Effect

| Metric | Target | Rationale |
|--------|--------|-----------|
| Median reviews per profile at 6 months | > 15 | Network effect: each review makes the profile more valuable. |
| Profile export / PDF download rate | Track (no target) | Indicates individuals are using reputation in job searches. |

---

## 8. Out of Scope / Future Considerations

The following are explicitly excluded from this PRD but may be addressed in future iterations:

| Item | Why Out of Scope |
|------|-----------------|
| **Five Qualities Framework** | Covered in PRD 02. This PRD covers the identity layer; the quality dimensions are a separate concern. |
| **Review flow UX (10-second flow)** | Covered in PRD 03. This PRD establishes that reviews attach to the individual; the review experience is designed separately. |
| **Rich media (voice/video reviews)** | Covered in PRD 04. Requires its own storage, moderation, and UX considerations. |
| **Monetization (Pro tier, Employer Dashboard, Recruiter Access)** | Covered in PRD 05. This PRD ensures the free individual profile is complete and valuable on its own. |
| **Anti-fraud / verification stack** | Covered in PRD 06. Trust mechanisms are critical but separate from identity. |
| **Verifiable references (customer opt-in for contact)** | Covered in PRD 07. Builds on top of the core identity layer. |
| **Monetary tips** | Parked. Different product direction. |
| **Custom QR code designs** | Future Pro tier feature. Free tier ships with standard QR. |
| **API / data integrations** | Enterprise feature, not part of core identity launch. |
| **Org-initiated profile creation** | Violates individual sovereignty principle. The individual must always create their own profile. |
