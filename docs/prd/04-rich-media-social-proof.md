# PRD 04: Rich Media as Social Proof

**Product:** Every Individual is a Brand - Portable Individual Review App
**Theme:** Rich Media as Social Proof (Text, Voice, Video Testimonials)
**Status:** Draft
**Date:** 2026-04-14
**Author:** Muthukumaran Navaneethakrishnan
**Brainstorm Refs:** Ideas #24, #25, #26, #44

---

## 1. Overview

### Why Rich Media Matters

A written review says "Ramesh was great." A voice review says it with genuine gratitude you can hear. A video review shows a real customer's face saying it. That video is not a review -- it is a personal endorsement. No company can fake that. No resume can compete with it.

Rich media transforms a profile from a collection of data points into a visceral, trust-generating experience. Text is scannable and searchable. Voice carries emotional authenticity that text cannot. Video combines face, voice, and emotion into the highest-trust form of social proof available.

### Strategic Role

Rich media serves three product goals simultaneously:

1. **Trust amplification** -- Video and voice reviews are Layer 5 of the anti-fraud stack. They are nearly impossible to fake at scale and earn a "Verified Testimonial" badge.
2. **Profile differentiation** -- Profiles with video testimonials stand out to recruiters and employers. They convert profile views into contact requests at higher rates.
3. **Monetization lever** -- The video highlights reel is a Pro tier feature ($5-10/month), giving individuals a reason to upgrade.

---

## 2. Three Expression Modes

All three modes are optional and appear as the final step (seconds 5-10) of the 10-second review flow. The customer has already tapped 1-2 qualities and given a thumbs up before reaching this step.

### 2.1 Text

- **Interaction:** Single text input field, placeholder: "Say something about [Name]..."
- **Max length:** 280 characters (one-liner, not an essay)
- **Required:** No
- **Auto-save:** Draft persists if the user navigates away and returns within the token validity window (24-48 hours)
- **Moderation:** Real-time profanity filter on submit; flagged content queued for review

### 2.2 Voice

- **Interaction:** Hold-to-record button (press and hold). Release to stop.
- **Max duration:** 15 seconds
- **Min duration:** 2 seconds (recordings under 2s are discarded with a prompt to try again)
- **Format:** Opus codec in WebM container (broad browser support, small file size)
- **Target file size:** Under 100 KB per recording
- **Playback:** Inline waveform player on the profile, no download option
- **Transcription:** Auto-transcribed server-side for searchability and accessibility (see Section 10)
- **Retry:** User can re-record before submitting. Only one take is stored.

### 2.3 Video

- **Interaction:** Tap to start recording. Tap again to stop. Front-facing camera default.
- **Max duration:** 30 seconds
- **Min duration:** 3 seconds (recordings under 3s are discarded with a prompt to try again)
- **Resolution:** 720p max capture. Server-side transcoding to 480p for delivery.
- **Format:** H.264 in MP4 container
- **Target file size:** Under 5 MB per recording (after compression)
- **Playback:** Adaptive bitrate streaming via HLS. Poster frame auto-generated from first non-black frame.
- **Transcription:** Auto-transcribed server-side for searchability and accessibility
- **Retry:** User can re-record or re-watch before submitting. Only one take is stored.

---

## 3. Impact and Fakeability Comparison

| Dimension | Text | Voice | Video |
|-----------|------|-------|-------|
| **Customer effort** | Low -- type a line | Low -- hold and talk for 15s | Medium -- point camera, talk for 30s |
| **Emotional impact** | Good -- scannable, quotable | High -- tone, pace, genuine feeling | Highest -- face + voice + emotion |
| **Searchability** | Native | Via transcription | Via transcription |
| **Fakeability** | Easy -- bots, copy-paste | Hard at scale -- voice synthesis detectable | Nearly impossible at scale -- deepfakes costly and detectable |
| **Trust signal** | Baseline | Strong -- "Verified Voice" indicator | Strongest -- "Verified Testimonial" badge |
| **Storage cost** | Negligible (~0.5 KB) | Low (~100 KB) | Moderate (~5 MB) |
| **Profile display** | Inline text with quotation marks | Waveform player with play button | Video thumbnail with play button |
| **Recruiter value** | Useful for keyword search | High -- hear customer sentiment | Highest -- equivalent to a live reference call |

---

## 4. Storage and Delivery Requirements

### 4.1 Compression Pipeline

| Stage | Text | Voice | Video |
|-------|------|-------|-------|
| **Client-side** | None | Opus encoding at 32 kbps | H.264 at 720p, hardware-accelerated where available |
| **Upload** | JSON payload | Binary upload via presigned URL | Binary upload via presigned URL, resumable (tus protocol) |
| **Server-side** | Sanitize, store | Normalize audio levels, transcode to AAC fallback | Transcode to 480p H.264, generate HLS segments (2s), extract poster frame |
| **Final size** | <1 KB | <100 KB | <5 MB |

### 4.2 Storage

- **Object storage:** S3-compatible (AWS S3 or MinIO for self-hosted dev)
- **Retention:** Indefinite for published reviews. Deleted reviews purged after 30-day grace period.
- **Redundancy:** Cross-region replication for media files
- **Naming:** `/{individual_id}/reviews/{review_id}/{type}.{ext}` -- flat structure, no nested date folders

### 4.3 CDN and Delivery

- **CDN:** CloudFront or equivalent edge network
- **Video streaming:** HLS with 2-second segments, two quality tiers (480p, 240p)
- **Voice playback:** Direct CDN delivery, no streaming protocol needed at <100 KB
- **Cache policy:** Media files cached at edge for 30 days (immutable content, cache-bust on deletion)
- **Lazy loading:** Media loads on scroll-into-view, not on page load. Poster frames and waveform previews load immediately.

### 4.4 Upload Reliability

- **Resumable uploads:** Video uploads use tus protocol to handle flaky mobile connections
- **Progress indicator:** Visual upload progress bar for video
- **Retry on failure:** Automatic retry (up to 3 attempts) with exponential backoff
- **Offline handling:** If connection drops mid-upload, the recording is saved locally and upload resumes when connectivity returns

---

## 5. Moderation and Content Policy

### 5.1 Automated Moderation

| Check | Applies To | Action |
|-------|-----------|--------|
| Profanity filter (text) | Text reviews | Block submission, prompt user to revise |
| Profanity filter (transcription) | Voice, video | Flag for human review, hold from publishing |
| Nudity/explicit content detection | Video | Auto-reject, notify reviewer |
| Audio toxicity classifier | Voice | Flag for human review |
| Spam pattern detection | All | Flag reviews matching known spam patterns |

### 5.2 Human Review Queue

- Flagged content enters a moderation queue visible to platform admins
- SLA: Flagged content reviewed within 4 hours during business hours
- Reviewer actions: Approve, Reject (with reason), Escalate
- Rejected reviews: Reviewer is notified with reason. No appeal in v1.

### 5.3 Content Policy (What Customers Cannot Do)

- No hate speech, threats, or harassment
- No personally identifiable information of third parties (e.g., mentioning another customer by name)
- No promotional content or spam
- No sexually explicit content
- No content unrelated to the service interaction

### 5.4 Individual's Rights

- The individual (profile owner) can flag a review for moderation but cannot unilaterally delete it
- The individual can respond to a review with a short text reply (280 chars max) -- planned for v2
- The customer (review author) can delete their own review at any time

---

## 6. Rich Media Display on Profiles

### 6.1 Free Tier Profile

- Reviews display in reverse-chronological order
- Text reviews: Inline quote block with customer initial avatar and date
- Voice reviews: Compact waveform player (play/pause, duration indicator)
- Video reviews: Thumbnail with play button, expands to inline player on tap
- All media types show the associated quality tags (e.g., "Care", "Initiative") and verification badges
- Maximum 3 video reviews pinned to profile top (most recent). Older videos remain accessible via "See all reviews" scroll.

### 6.2 Pro Tier Profile ($5-10/month)

Everything in Free, plus:

- **Video highlights reel:** Auto-generated montage of the individual's top video testimonials
  - Duration: 60-90 seconds
  - Algorithm: Selects clips based on view count, recency, and quality tag diversity
  - Regenerated weekly or on-demand by the individual
  - Shareable as a standalone link (e.g., for job applications, social media bios)
- **Pinned testimonials:** Individual can pin up to 5 reviews (any type) to profile top
- **Custom poster frames:** Individual can select the poster frame for each video review
- **Testimonial categories:** Group reviews by quality tag or time period

### 6.3 Display Optimization

- Profile loads text-first, media lazy-loads on scroll
- Video autoplay disabled by default (respects OS-level accessibility preferences)
- Waveform visualizations render as static SVG until playback starts
- All media players use native controls for accessibility

---

## 7. Feature Requirements

### 7.1 Must Have (v1)

| ID | Feature | Description |
|----|---------|-------------|
| RM-01 | Text review input | 280-char text field in review flow, step 3 |
| RM-02 | Hold-to-record voice | Press-and-hold recording, 2-15s, Opus/WebM |
| RM-03 | Tap-to-record video | Front camera, 3-30s, H.264/MP4 at 720p capture |
| RM-04 | Media upload pipeline | Presigned URLs, resumable video upload, server-side transcoding |
| RM-05 | Profile media display | Inline players for voice and video on profile pages |
| RM-06 | Auto-transcription | Server-side transcription for voice and video, stored as searchable text |
| RM-07 | Automated moderation | Profanity filter (text), nudity detection (video), toxicity classifier (voice) |
| RM-08 | CDN delivery | Edge-cached media with HLS for video |
| RM-09 | Verification badges | "Verified Voice" and "Verified Testimonial" badges on voice/video reviews |
| RM-10 | Customer delete | Review author can delete their own review and associated media |

### 7.2 Should Have (v1.1)

| ID | Feature | Description |
|----|---------|-------------|
| RM-11 | Video highlights reel | Auto-generated montage for Pro tier |
| RM-12 | Pinned testimonials | Pro users pin up to 5 reviews to profile top |
| RM-13 | Individual reply | Profile owner can reply to reviews (280 chars) |
| RM-14 | Transcription editing | Individual can correct auto-transcription errors |

### 7.3 Nice to Have (v2+)

| ID | Feature | Description |
|----|---------|-------------|
| RM-15 | Multi-language transcription | Support transcription in top 10 languages |
| RM-16 | AI-generated review summary | "Customers say Ramesh is..." summary from aggregated transcripts |
| RM-17 | Embeddable video widget | Embed a testimonial video on external sites |
| RM-18 | Reaction emoji on reviews | Other viewers can react to reviews (social validation layer) |

---

## 8. User Stories

### Customer (Review Author)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-01 | As a customer, I want to leave a quick text note after tapping qualities so I can say something specific about the person. | Text field appears after thumbs-up. 280 char limit enforced. Submission completes in <1s. |
| US-02 | As a customer, I want to hold a button and record a voice message so I can express genuine gratitude without typing. | Hold-to-record activates mic with permission prompt. Timer visible. Release stops recording. Playback available before submit. |
| US-03 | As a customer, I want to record a short selfie video so I can give a personal endorsement that carries real weight. | Front camera activates. Countdown (3-2-1) before recording starts. Timer visible. Tap stops. Preview plays before submit. |
| US-04 | As a customer, I want to re-record before submitting so I can get it right without pressure. | Re-record button available on preview screen. Previous take is discarded on re-record. |
| US-05 | As a customer, I want to delete my review later if I change my mind. | Delete option in "My Reviews" section. Confirmation dialog. Media purged within 30 days. |

### Individual (Profile Owner)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-06 | As an individual, I want video and voice reviews displayed prominently on my profile so visitors see real social proof. | Video thumbnails and voice waveforms render above text-only reviews. Play inline without leaving profile. |
| US-07 | As an individual, I want a "Verified Testimonial" badge on video reviews so employers and recruiters trust them more. | Badge renders next to video reviews. Badge logic: video exists + passed moderation. |
| US-08 | As a Pro user, I want an auto-generated video highlights reel so I can share a polished summary of my best testimonials. | Reel generated from top videos (by views + recency). 60-90s duration. Shareable link. Regenerates weekly. |
| US-09 | As an individual, I want to flag a review for moderation if it contains inappropriate content. | Flag button on each review. Flagged reviews enter moderation queue. Individual notified of outcome. |

### Recruiter / Employer

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-10 | As a recruiter, I want to watch video testimonials on a candidate's profile so I can assess customer sentiment beyond text. | Video plays inline on profile. HLS streaming, no buffering on 4G+. Transcription visible as captions. |
| US-11 | As an employer, I want to see which team members have video testimonials so I can identify top performers with strong customer proof. | Employer dashboard shows media-type breakdown per team member. Filter by "has video." |

---

## 9. Success Metrics

| Metric | Target (6 months post-launch) | Measurement |
|--------|-------------------------------|-------------|
| **Rich media attachment rate** | 15% of reviews include voice or video | (voice + video reviews) / total reviews |
| **Voice recording completion rate** | 70% of started recordings are submitted | submitted / started |
| **Video recording completion rate** | 50% of started recordings are submitted | submitted / started |
| **Average video review duration** | 12-18 seconds | median duration of submitted videos |
| **Profile engagement lift (with video)** | 3x time-on-profile vs text-only profiles | avg session duration comparison |
| **Recruiter contact rate (video profiles)** | 2x vs profiles without video | contact requests / profile views |
| **Pro tier conversion (video users)** | 10% of individuals with 3+ video reviews upgrade to Pro | Pro conversions / eligible individuals |
| **Moderation false positive rate** | <5% of auto-flagged content is approved on human review | approved-after-flag / total flagged |
| **Upload success rate** | >98% of started uploads complete | completed / started |
| **Transcription accuracy** | >90% word-level accuracy (English) | WER on sample set |

---

## 10. Technical Considerations

### 10.1 File Sizes and Formats

| Type | Capture Format | Delivery Format | Max Raw Size | Max Delivered Size |
|------|---------------|-----------------|-------------|-------------------|
| Text | UTF-8 string | UTF-8 string | 1 KB | 1 KB |
| Voice | Opus/WebM, 32 kbps | Opus/WebM + AAC/MP4 fallback | 120 KB | 100 KB |
| Video | H.264/MP4, 720p | H.264/MP4, 480p, HLS | 15 MB | 5 MB |

### 10.2 Transcription

- **Engine:** Whisper (self-hosted) or cloud speech-to-text API (Google/AWS) -- decision based on cost at scale
- **Trigger:** Async job queued on upload completion. Transcription available within 60 seconds.
- **Languages:** English only in v1. Top 10 languages in v2 (Hindi, Spanish, Mandarin, Arabic, French, Portuguese, Japanese, Korean, German, Tamil)
- **Storage:** Transcription stored as plain text alongside the media record, indexed for full-text search
- **Cost estimate:** ~$0.006/15s voice clip (cloud API), ~$0.024/30s video (cloud API). At 10K reviews/month with 15% media rate: ~$22/month transcription cost.

### 10.3 Accessibility

- All voice reviews have visible transcription text (expandable below the player)
- All video reviews have closed captions generated from transcription
- Media players are keyboard-navigable (play/pause via Space, seek via arrow keys)
- Alt text on video thumbnails: "[Customer first name] video testimonial for [Individual name], [duration]"
- Screen reader announcements on recording state changes ("Recording started", "Recording stopped", "Upload complete")
- Reduced motion: Users with `prefers-reduced-motion` see a static thumbnail instead of any animated preview

### 10.4 Browser and Device Support

- **Voice recording:** MediaRecorder API. Supported in Chrome, Firefox, Safari 14.5+, Edge. Fallback: text-only for unsupported browsers.
- **Video recording:** MediaRecorder API + getUserMedia (front camera). Same browser support matrix. Fallback: voice or text.
- **Mobile-first:** Recording UX optimized for mobile (where most QR scans happen). Desktop supported but not primary.
- **Permissions:** Camera and mic permissions requested only when the user taps the voice/video button, not on page load.

### 10.5 Infrastructure

- **Transcoding workers:** Dedicated worker pool (or serverless functions) for video transcoding. Auto-scales based on upload queue depth.
- **Storage tiering:** Hot storage (S3 Standard) for media <90 days old. Warm storage (S3 IA) for older media. Retrieval time acceptable for older reviews.
- **Estimated storage at scale:** 10K reviews/month, 15% media rate, avg 3 MB/media file = ~4.5 GB/month media storage. ~54 GB/year. Manageable.
- **Monitoring:** Track upload failures, transcoding errors, CDN cache hit ratio, playback start failures. Alert on upload success rate dropping below 95%.
