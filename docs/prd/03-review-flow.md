# PRD 03: The 10-Second Review Flow

**Product:** Every Individual is a Brand — Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**Theme:** Theme 3 — The 10-Second Review Flow
**Brainstorm Ref:** Ideas #6, #19, #20, #21, #22, #23, #24, #25, #26

---

## 1. Overview

The review flow is the single most critical UX surface in the product. If a customer cannot leave a review in under 10 seconds, they will not leave one at all. Every additional tap, screen, or decision point bleeds completion rate.

**The 10-second constraint is not a target. It is a hard ceiling.**

The mandatory portion of the flow (quality selection + thumbs up) must complete in 5 seconds or less. The remaining 5 seconds are reserved for optional rich media (text, voice, or video). No account creation. No login. No app install. The customer scans a QR code and lands directly in the review flow on their mobile browser.

### Why speed matters

- Survey fatigue is the default state. Traditional post-service feedback (email surveys, NPS forms, comment cards) achieves 2-5% response rates.
- Single-action feedback systems (HappyOrNot terminals, Uber star ratings) achieve 20-50%+ response rates.
- The difference is not motivation. Customers want to recognize good service. The difference is friction. Every second of friction is a decision point where the customer can abandon.
- For this product, review volume per individual is the core value driver. A profile with 3 reviews is noise. A profile with 300 reviews is a verified reputation. The flow must optimize for volume above all else.

---

## 2. The Flow — Second-by-Second Breakdown

### Prerequisites

- The individual (service worker) has a profile and a personal QR code.
- The customer has a smartphone with a camera and mobile browser.
- No app install required. No account required. No login required.

### Flow Sequence

| Second | Screen | Customer Action | Required? | Notes |
|--------|--------|----------------|-----------|-------|
| 0-1 | **QR Scan** | Customer scans QR code with phone camera | -- | Opens mobile browser. Profile loads with person's name, photo, and current org tag. |
| 1-3 | **Quality Selection** | Tap 1-2 qualities that stood out | **Yes** | Five quality chips displayed: Expertise, Care, Delivery, Initiative, Trust. Customer taps the ones that apply. Minimum 1, maximum 2. |
| 3-5 | **Thumbs Up** | Tap the thumbs-up confirmation | **Yes** | Single large button. This is the submit action for the mandatory portion. Review is recorded at this point. |
| 5-7 | **Rich Media Prompt** | Choose to add text, voice, or video — or skip | No | Screen shows three options + a "Done" button. If customer taps "Done" or takes no action for 3 seconds, flow ends with a thank-you screen. |
| 7-10 | **Rich Media Capture** | Record voice (15s max), record video (30s max), or type a one-liner | No | Media is attached to the already-submitted review. |

### Critical constraints

- **No scrolling on any screen.** Every screen must fit above the fold on a 375px-wide viewport (iPhone SE / small Android).
- **No keyboard required** until the optional text step.
- **No loading spinners.** Profile data must be pre-fetched or cached at the QR endpoint. Target: profile loads in under 500ms on 4G.
- **The review is submitted at the thumbs-up tap (second 3-5).** Rich media is appended after, not gating submission. If the customer closes the browser after thumbs-up, the review is already saved.

---

## 3. QR Code Specifications

### Ownership model

The QR code belongs to the individual, not the organization. It is their portable identity anchor. When an individual changes jobs, the same QR code continues to work — it points to their profile, which now shows their new org tag (or no org tag).

### Generation

- Generated automatically when an individual creates a profile.
- Encodes a short URL: `https://{domain}/r/{unique_id}` (e.g., `https://app.example.com/r/k7x9m2`).
- The `unique_id` is a permanent, non-sequential, URL-safe identifier (8-12 characters). It never changes.
- QR version: Use QR Code version that fits the URL with error correction level H (30% recovery). This ensures readability even with logo overlay or wear damage.

### Display formats

| Format | Use Case | Spec |
|--------|----------|------|
| **Digital badge** | Phone lock screen, digital wallet | 300x300px PNG, transparent background, individual's name below |
| **Printed badge/lanyard** | Physical ID badge, lanyard card | 25x25mm minimum print size, 300 DPI, includes name + "Scan to review me" CTA |
| **Business card** | Networking, personal branding | Corner placement, 20x20mm, paired with name and title |
| **Table tent / counter card** | Retail counter, hotel desk, bank desk | 50x50mm, large CTA text: "How did I do? Scan to let me know." |
| **Sticker** | Laptop, notebook, car dashboard | 40x40mm, weather-resistant stock option |

### Customization (Pro tier)

- Custom color scheme for QR code (brand colors).
- Logo overlay in center of QR code.
- Custom short URL slug (e.g., `/r/ramesh-kumar` instead of `/r/k7x9m2`).

### Technical requirements

- QR code must resolve in under 300ms on scan (server-side redirect to profile + review flow).
- The URL must support link preview metadata (Open Graph tags) so that if shared via messaging apps, it shows the individual's name and photo.
- QR code must work offline-first: if the customer scans but has intermittent connectivity, the review flow page should cache locally (service worker) and sync when connection restores.

---

## 4. Review Submission UX

### Quality selection — "Pick what stood out"

This is the core interaction. The customer sees five quality chips and taps the ones that resonated.

**Design principles:**

- **Selection, not rating.** The customer picks qualities, not scores. There are no stars, sliders, or numeric scales. The question is "What made this person stand out?" not "Rate this person on five dimensions."
- **1-2 picks, not all five.** Minimum 1, maximum 2. Forcing the customer to evaluate all five qualities turns a 2-second interaction into a 15-second cognitive task. The constraint also produces better data — it forces the customer to identify what was genuinely distinctive, not give everything a 4/5.
- **Aggregation reveals truth.** Over hundreds of reviews, the distribution of quality picks becomes the individual's signature strength profile. If 70% of customers pick "Care" and 45% pick "Expertise," that profile tells a clear story.

### Chip layout

- Five chips displayed in a single horizontal row or a 3-2 grid (responsive based on screen width).
- Each chip shows: icon + quality name (e.g., a heart icon + "Care").
- Unselected state: outline style, muted color.
- Selected state: filled, with brand accent color and a subtle scale animation (100ms).
- Tapping a selected chip deselects it.
- If the customer tries to select a third chip, the oldest selection deselects automatically with a brief shake animation.

### Thumbs-up confirmation

- Single large button, centered, prominent.
- Label: "Thumbs Up" with a thumbs-up icon.
- This is not a binary thumbs-up/thumbs-down. There is no thumbs-down. The product only captures positive recognition. If the customer had a bad experience, they simply do not scan the QR code.
- On tap: the review is submitted immediately. A brief success animation plays (checkmark, confetti, or similar — under 500ms), then the rich media prompt appears.

### No negative reviews — by design

The product captures recognition, not ratings. There is no mechanism to leave a negative review. This is a deliberate product decision:

- The QR code is initiated by the individual. Customers only scan it when prompted or motivated.
- Negative feedback channels already exist (manager complaints, Google reviews of the business, social media).
- The product's value is in accumulating proof of positive impact. A profile with zero reviews says nothing negative — it just says nobody has reviewed yet.

---

## 5. Rich Media Capture

After the mandatory thumbs-up, the customer is offered three optional expression modes. They can pick one (not multiple) or skip entirely.

### Text one-liner

- Single text input field. No title, no separate fields.
- Placeholder text: "What made it great?" (rotating examples: "Knew exactly what I needed," "Made my day," "Best service I've had").
- Character limit: 280 characters (tweet-length). Enforced with a visible character counter that turns red at 260.
- No profanity filter on input — apply server-side moderation asynchronously. Do not block the submission flow.
- Submit button: "Add" — single tap, done.

### Voice note — 15 seconds max

- **Hold-to-record interaction.** Customer presses and holds a microphone button. Release stops recording.
- Maximum duration: 15 seconds. At 15 seconds, recording auto-stops.
- Visual feedback during recording: pulsing waveform animation, elapsed time counter.
- On release: immediate playback preview (auto-plays once). Two buttons: "Use this" and "Re-record."
- No transcription shown to the customer. Transcription happens server-side for search/moderation.
- File format: Opus codec in WebM container (browser-native, no transcoding needed client-side).
- Fallback: If browser does not support MediaRecorder API, hide the voice option entirely. Do not show a broken button.

### Video — 30 seconds max, selfie-style

- Activates front-facing camera.
- **Tap-to-start, tap-to-stop** (not hold-to-record — holding a phone steady for 30 seconds is uncomfortable).
- Maximum duration: 30 seconds. Auto-stops at 30 seconds.
- Visual feedback: recording indicator (red dot), elapsed time counter.
- On stop: playback preview. Two buttons: "Use this" and "Re-record."
- Resolution: 720p maximum (balance quality vs. upload size).
- File format: WebM (VP8/VP9) or MP4 (H.264) depending on browser support.
- Upload: chunked upload in background. Show progress bar. If upload fails, retry automatically up to 3 times. If all retries fail, save locally and prompt to retry later.
- **Privacy notice:** Before camera activates, show a one-line notice: "This video will appear on [Name]'s public profile." Customer must tap "OK" to proceed. This is shown only once per session.

### Media attachment rules

- Only one media type per review. Customer picks text OR voice OR video.
- Media is appended to the already-submitted review. The review exists with or without media.
- Media can be added within 24 hours of the original review submission (in case the customer leaves the flow and wants to come back via the same URL).

---

## 6. Progressive Disclosure Design

The flow uses progressive disclosure to maximize completion rate while enabling rich expression for motivated customers.

### Layer 1 — Mandatory (target: 5 seconds)

| Element | Interaction | Time budget |
|---------|-------------|-------------|
| Quality chips | Tap 1-2 | 2 seconds |
| Thumbs up | Tap 1 | 1 second |
| Transitions/load | -- | 2 seconds |

At this point, the review is complete and submitted. The customer has provided:
- Which qualities stood out (structured data)
- A positive endorsement (thumbs up)
- Metadata: timestamp, device fingerprint, location (if permitted)

### Layer 2 — Optional rich media (target: 5 seconds for decision + capture)

This screen appears only after Layer 1 is complete. It shows three options (text, voice, video) and a "Done" button.

**Auto-dismiss rule:** If the customer does not interact with this screen within 5 seconds, it auto-transitions to the thank-you screen. The review is already saved. This prevents the optional screen from feeling like a blocker.

### Layer 3 — Thank-you screen

- Shows: "Thanks! Your review helps [Name] build their brand."
- Shows the individual's current quality breakdown as a simple bar chart (so the customer sees how their input contributes).
- Optional: "Share [Name]'s profile" button (generates a shareable link).
- This screen is informational only. No action required.

### Why this structure works

- **Layer 1 alone** gives the product usable structured data at massive scale.
- **Layer 2** captures the high-impact social proof (voice/video testimonials) from the subset of customers who are motivated enough. Even a 10% attachment rate on media produces significant content over time.
- **Layer 3** closes the loop and introduces a viral sharing mechanic.

---

## 7. Mobile-First Design Requirements

### Viewport and layout

- **Primary target:** Mobile browser (Safari iOS, Chrome Android). No app install.
- **Minimum supported viewport:** 320px wide (iPhone SE first generation).
- **Design target viewport:** 375px wide (iPhone SE 3rd gen / standard Android).
- **All interactions must be thumb-reachable.** Primary actions in the bottom 60% of the screen.
- **No pinch-to-zoom required.** Font sizes minimum 16px for body, 20px for labels, 44px minimum tap target size (per Apple HIG).

### Performance

- **First contentful paint:** Under 1 second on 4G (target: 500ms).
- **Time to interactive:** Under 1.5 seconds on 4G.
- **Total page weight:** Under 200KB initial load (excluding media uploads).
- **Service worker caching:** Cache the review flow shell so repeat visitors load instantly.
- **Offline resilience:** If connectivity drops mid-review, queue the submission and sync when restored. Show a "Saved, will submit when online" message.

### Browser support

- Safari 15+ (iOS 15+)
- Chrome 90+ (Android 10+)
- Samsung Internet 16+
- No dependency on features unavailable in mobile browsers (no Web Bluetooth, no NFC unless progressive enhancement).

### Accessibility

- All tap targets: 44x44px minimum.
- Color contrast: WCAG AA minimum (4.5:1 for text, 3:1 for large text and UI components).
- Screen reader support: all chips and buttons must have aria-labels.
- Haptic feedback on tap (where supported via Vibration API — 10ms pulse on quality chip select, 30ms on submit).

---

## 8. Feature Requirements

### P0 — Must have for launch

| ID | Feature | Description |
|----|---------|-------------|
| RF-01 | QR code generation | Auto-generate a personal QR code on profile creation, encoding the individual's permanent short URL. |
| RF-02 | QR scan to review flow | Scanning the QR code opens the review flow in the customer's mobile browser. No app install, no login. |
| RF-03 | Quality chip selection | Display five quality chips. Customer taps 1-2. Minimum 1 required to proceed. |
| RF-04 | Thumbs-up submit | Single tap submits the review. Review is persisted server-side immediately. |
| RF-05 | Text one-liner | Optional 280-character text input after submission. |
| RF-06 | Voice note capture | Optional hold-to-record voice note, 15-second max, with playback preview. |
| RF-07 | Video capture | Optional selfie-style video, 30-second max, with playback preview and privacy notice. |
| RF-08 | Thank-you screen | Post-submission confirmation with quality breakdown visualization. |
| RF-09 | Mobile-first responsive UI | Full flow works on 320px+ viewports, thumb-reachable, no scrolling on any screen. |
| RF-10 | Offline queue | If connectivity drops, queue review and sync on reconnect. |

### P1 — Should have for launch

| ID | Feature | Description |
|----|---------|-------------|
| RF-11 | QR download formats | Provide QR code as PNG, SVG, and PDF in multiple sizes (badge, card, counter tent). |
| RF-12 | Auto-dismiss on optional screen | If no interaction in 5 seconds on the rich media screen, auto-transition to thank-you. |
| RF-13 | Share profile link | On thank-you screen, offer a shareable link to the individual's profile. |
| RF-14 | Service worker caching | Cache flow shell for instant repeat loads. |
| RF-15 | Media upload retry | Chunked upload with automatic retry (3 attempts) for voice/video. |

### P2 — Nice to have

| ID | Feature | Description |
|----|---------|-------------|
| RF-16 | Custom QR colors/logo | Pro tier: custom QR code styling with brand colors and center logo. |
| RF-17 | Custom short URL slug | Pro tier: vanity URL for the individual's review link. |
| RF-18 | Haptic feedback | Vibration API pulse on chip selection and submit. |
| RF-19 | Animated transitions | Micro-animations on chip select (scale), submit (confetti), and screen transitions (slide). |
| RF-20 | 24-hour media append | Allow customer to return to the same URL within 24 hours to add media to an existing review. |

---

## 9. User Stories

### Customer (reviewer)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-01 | As a customer, I want to scan a QR code and immediately see who I am reviewing, so I know I am recognizing the right person. | Profile loads with name, photo, and current org within 1 second of scan. |
| US-02 | As a customer, I want to tap the qualities that stood out to me, so I can give specific recognition without writing anything. | I can select 1-2 quality chips. Chips are large, labeled, and require a single tap each. |
| US-03 | As a customer, I want to submit my review with one tap after selecting qualities, so I can finish quickly. | Thumbs-up button submits the review. I see confirmation within 500ms. |
| US-04 | As a customer, I want to optionally leave a voice note, so I can express gratitude naturally without typing. | Hold-to-record button captures audio up to 15 seconds. I can preview and re-record before confirming. |
| US-05 | As a customer, I want to optionally record a short video, so I can give a personal endorsement. | Front camera activates. I can record up to 30 seconds. I see a privacy notice before recording starts. |
| US-06 | As a customer, I want to skip the optional media step without feeling guilty, so the process does not feel pushy. | "Done" button is equally prominent as media options. Screen auto-dismisses after 5 seconds of inactivity. |
| US-07 | As a customer, I do not want to create an account or install an app to leave a review. | The entire flow works in a mobile browser with no login or signup. |
| US-08 | As a customer, I want my review to be saved even if I lose internet mid-flow. | Review is queued locally and synced when connectivity restores. I see a "Saved" confirmation. |

### Individual (profile owner)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-09 | As an individual, I want a personal QR code that stays with me when I change jobs, so my reputation is portable. | QR code URL is tied to my profile, not my employer. Changing employer does not change my QR code. |
| US-10 | As an individual, I want to download my QR code in multiple formats, so I can print it on my badge, business card, or counter tent. | QR available as PNG (300px, 600px), SVG, and PDF in at least three layout templates. |
| US-11 | As an individual, I want to see which qualities customers recognize most, so I know my signature strengths. | Dashboard shows quality distribution as a bar/radar chart, updated after each review. |
| US-12 | As an individual, I want to receive a notification when a customer leaves a review with media, so I can see the testimonial. | Push notification or email sent within 1 minute of media review submission. |

---

## 10. Success Metrics

### Primary metrics

| Metric | Definition | Target | Rationale |
|--------|-----------|--------|-----------|
| **Flow completion rate** | % of QR scans that result in a submitted review (thumbs-up tapped) | >60% | HappyOrNot achieves 50%+ with single-tap. Our 3-tap flow (1-2 chips + thumbs up) should achieve similar with good UX. |
| **Time to submit (mandatory)** | Median time from profile load to thumbs-up tap | <5 seconds | The 10-second budget allocates 5s to mandatory. Median should be well under. |
| **Time to complete (full flow)** | Median time from profile load to final screen (including optional media) | <12 seconds | Allow slight overflow for media capture. 90th percentile should be under 20 seconds. |

### Secondary metrics

| Metric | Definition | Target | Rationale |
|--------|-----------|--------|-----------|
| **Media attachment rate** | % of submitted reviews that include text, voice, or video | >15% | Uber sees ~10-15% of riders leave optional comments. Voice/video options should push this higher. |
| **Voice attachment rate** | % of media attachments that are voice | >30% of media | Voice is the sweet spot: low effort, high authenticity. Should be the most popular media type. |
| **Video attachment rate** | % of media attachments that are video | >10% of media | Video is highest impact but highest effort. Even 10% produces valuable content at scale. |
| **Bounce rate at QR scan** | % of QR scans where customer leaves before any interaction | <20% | If profile loads fast and the UI is clear, most scanners should engage. |
| **Quality chip distribution** | Entropy of quality selections across all reviews for a given individual | No single quality >80% | High entropy means the qualities are well-differentiated. If everyone picks the same one, the framework is not adding signal. |
| **Repeat reviewer rate** | % of customers who review the same individual more than once (within allowed time windows) | <5% | High repeat rate may indicate gaming. Low repeat rate confirms genuine unique interactions. |

### Guardrail metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| Flow completion rate drops below 40% | Alert | Investigate UX friction. A/B test flow variations. |
| Median time to submit exceeds 8 seconds | Alert | Audit load times, interaction bottlenecks. |
| Media upload failure rate exceeds 5% | Alert | Investigate chunked upload reliability, network edge cases. |

---

## 11. Research Backing

### HappyOrNot smiley terminals

- **What:** Physical terminals with 4 smiley-face buttons placed at store exits, airports, restrooms.
- **Result:** Single-tap feedback achieves 50%+ response rates. Over 1.5 billion feedbacks collected.
- **Lesson for us:** One tap is the gold standard. Our mandatory flow requires 2-3 taps (1-2 chips + thumbs up). This is acceptable if each tap is a clear, fast, no-thought action. Going beyond 3 taps will crater completion rates.
- **Source:** [happy-or-not.com](https://www.happy-or-not.com/en/solution/smiley-terminal/)

### Uber post-ride feedback

- **What:** After every ride, the rider rates the driver (1-5 stars). Then optionally selects tag chips ("Great conversation," "Expert navigation") and optionally leaves a text comment.
- **Result:** Star rating completion is near-universal (built into the flow). Tag chip selection is ~20-30%. Text comments are ~10-15%.
- **Lesson for us:** Progressive disclosure works. The mandatory action gets near-100% completion. Each optional layer drops off by roughly half. Design for this drop-off — make Layer 1 data-rich enough to be valuable on its own.

### Emoji-based and visual feedback

- **What:** Multiple studies show emoji/icon-based feedback achieves 40-70% higher response rates than text-based surveys.
- **Lesson for us:** Quality chips should be visually distinct (icons + labels, not text-only). The interaction should feel like tapping emojis, not filling out a form.

### Key takeaway

The research consistently shows: **reduce cognitive load, reduce taps, reduce time, and response rates climb dramatically.** Our 10-second ceiling with a 5-second mandatory core is aggressive but achievable. The constraint is the feature.

---

## Appendix: Flow Wireframe (Text)

```
Screen 1: Profile + Quality Selection
+----------------------------------+
|  [Photo]  Ramesh Kumar            |
|  Service Advisor @ ABC Motors     |
|                                   |
|  What stood out?                  |
|                                   |
|  [Expertise] [Care] [Delivery]   |
|  [Initiative]  [Trust]           |
|                                   |
|       [ Thumbs Up ]              |
+----------------------------------+

Screen 2: Optional Media (after submit)
+----------------------------------+
|  Review saved!                    |
|                                   |
|  Want to add more?                |
|                                   |
|  [Text]  [Voice]  [Video]        |
|                                   |
|       [ Done ]                   |
+----------------------------------+

Screen 3: Thank You
+----------------------------------+
|  Thanks! You recognized Ramesh.   |
|                                   |
|  Ramesh's strengths:              |
|  Care     ████████████░░  72%     |
|  Expertise ██████████░░░  58%     |
|  Delivery  ████████░░░░░  45%     |
|  Initiative ██████░░░░░░  33%     |
|  Trust     █████░░░░░░░░  28%     |
|                                   |
|  [ Share Ramesh's Profile ]       |
+----------------------------------+
```
