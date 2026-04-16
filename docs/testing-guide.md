# ReviewApp — Testing Guide

**Last updated:** 2026-04-16

---

## Live URLs

| Service | URL | Purpose |
|---|---|---|
| **API** | https://review-api.teczeed.com | Backend API |
| **QR Review** | https://review-scan.teczeed.com | Customer review flow (mobile web) |
| **Dashboard** | https://review-dashboard.teczeed.com | Individual/Employer/Recruiter dashboard |
| **Public Profiles** | https://review-profile.teczeed.com | Shareable public profiles |

---

## How to Test

### Flow 1: Leave a Review (Customer — No Login Required)

This is the core flow. No account needed.

1. Open https://review-scan.teczeed.com/r/ramesh-kumar on your phone
2. You'll see Ramesh's profile with 5 quality chips: **Expertise, Care, Delivery, Initiative, Trust**
3. Tap **1 or 2 qualities** that stand out
4. Tap the **thumbs up** button to submit
5. Optionally add a text comment (280 chars max)
6. Done — review submitted

**Other profiles to test:**

| Profile | URL | Industry | Reviews |
|---|---|---|---|
| Ramesh Kumar | https://review-scan.teczeed.com/r/ramesh-kumar | Auto Sales | 150 |
| Sarah Williams | https://review-scan.teczeed.com/r/sarah-williams | Healthcare | 200 |
| Priya Sharma | https://review-scan.teczeed.com/r/priya-sharma | Hospitality | 80 |
| David Chen | https://review-scan.teczeed.com/r/david-chen | Banking | 45 |
| Lisa Tan | https://review-scan.teczeed.com/r/lisa-tan | F&B | 30 |
| Ahmed Hassan | https://review-scan.teczeed.com/r/ahmed-hassan | Retail | 12 |

### Flow 2: Sign In (Google Account)

1. Open https://review-dashboard.teczeed.com
2. Click **"Sign in with Google"**
3. Select your Google account
4. You'll be auto-registered as an **INDIVIDUAL** user
5. You'll land on the dashboard

**Note:** First-time users are created automatically. No invitation needed.

### Flow 3: View Public Profile

1. Open https://review-profile.teczeed.com/profile/ramesh-kumar
2. See quality heat map (5 bars showing Expertise, Care, etc.)
3. See review list with quality badges
4. Try other profiles: `/profile/sarah-williams`, `/profile/priya-sharma`

### Flow 4: Stripe Subscription (Test Mode)

1. Sign in on the dashboard
2. Navigate to subscription/upgrade
3. Checkout uses **Stripe test mode** — use these test cards:

| Card Number | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | 3D Secure required |

**Expiry:** Any future date. **CVC:** Any 3 digits.

**Subscription tiers:**

| Tier | Price |
|---|---|
| Pro Individual | $10/month or $60/year |
| Employer Small | $50/month |
| Employer Medium | $100/month |
| Employer Large | $200/month |
| Recruiter Basic | $500/month |
| Recruiter Premium | $1,000/month |

---

## API Testing (Direct)

### Health Check
```
curl https://review-api.teczeed.com/health
```

### Get Qualities
```
curl https://review-api.teczeed.com/api/v1/qualities
```

### Get Profile
```
curl https://review-api.teczeed.com/api/v1/profiles/ramesh-kumar
```

### Get Reviews
```
curl "https://review-api.teczeed.com/api/v1/reviews/profile/<profile-id>?limit=5"
```

### Scan QR (Start Review)
```
curl -X POST https://review-api.teczeed.com/api/v1/reviews/scan/ramesh-kumar \
  -H "Content-Type: application/json" \
  -d '{"deviceFingerprint":"test1234567890abcdef"}'
```

### Submit Review
```
curl -X POST https://review-api.teczeed.com/api/v1/reviews/submit \
  -H "Content-Type: application/json" \
  -d '{
    "reviewToken": "<token-from-scan>",
    "qualities": ["expertise", "trust"],
    "qualityDisplayOrder": ["expertise","care","delivery","initiative","trust"],
    "thumbsUp": true
  }'
```

---

## Seed Data

### Individual Profiles

| Name | Slug | Industry | Reviews | Top Quality |
|---|---|---|---|---|
| Ramesh Kumar | ramesh-kumar | Auto Sales | 150 | Expertise (35%) |
| Sarah Williams | sarah-williams | Healthcare | 200 | Care (35%) |
| Priya Sharma | priya-sharma | Hospitality | 80 | Care (31%) |
| David Chen | david-chen | Banking | 45 | Expertise (32%) |
| Lisa Tan | lisa-tan | F&B | 30 | Initiative (31%) |
| Ahmed Hassan | ahmed-hassan | Retail | 12 | Expertise (20%) |

### Organizations (Singapore)

| Organization | Industry |
|---|---|
| ABC Auto Dealership | Auto Sales |
| Grand Hotel Singapore | Hospitality |
| DBS Bank | Banking |
| Mount Elizabeth Hospital | Healthcare |
| Tangs Department Store | Retail |
| Din Tai Fung | F&B |

### Five Qualities

| Quality | Customer Language |
|---|---|
| **Expertise** | "Expert in their domain" |
| **Care** | "Made me feel valued" |
| **Delivery** | "Did exactly what they promised" |
| **Initiative** | "Went beyond what I asked" |
| **Trust** | "I'd come back to this person" |

---

## Known Limitations (Beta)

- **Mobile app:** Currently a blank Expo screen — mobile flows are web-only for now
- **OTP verification:** Running in mock mode — OTP is logged to server console, not sent via SMS
- **Media upload:** Voice/video upload not tested end-to-end
- **Role requests:** Admin approval UI not built yet — admin must use API directly
- **Stripe webhooks:** Not connected to deployed API — subscription status won't auto-update after payment

---

## Reporting Issues

If something doesn't work, note:
1. What you were trying to do
2. What URL you were on
3. What happened vs. what you expected
4. Your device/browser

Report to: muthuishere@gmail.com
