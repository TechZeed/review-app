# Spec 15: Project Status — What's Working, What's Not

**Project:** ReviewApp — Portable Individual Review/Reputation Platform
**Date:** 2026-04-16
**Repo:** elan-chels/review-app (17 commits on main)

---

## 1. What's Built

### Documentation (22 docs)
| Type | Count | Status |
|---|---|---|
| Brainstorm | 1 | 50 ideas, 8 themes |
| PRDs | 8 | All product areas covered |
| Technical Specs | 14 | Project structure through infrastructure |
| Deployment Guide | 1 | Full GCP deployment guide |

### Backend API (117 source files)
| Module | Files | Endpoints | Status |
|---|---|---|---|
| auth | 7 | 4 (register, login, logout, me) | Built, not integration-tested |
| profile | 8 | 7 (CRUD, QR, visibility, stats) | Built, working on Cloud Run |
| review | 7 | 4 (scan, submit, by-profile, my-reviews) | Built, working on Cloud Run |
| quality | 7 | 2 (list, by-profile) | Built, working on Cloud Run |
| verification | 7 | 4 (initiate, send-otp, verify-otp, validate-token) | Built, OTP in mock mode |
| media | 8 | 3 (upload, get, signed-url) | Built, upload not tested e2e |
| organization | 7 | 5 (create, tag, untag, by-profile, members) | Built, not tested |
| recruiter | 7 | 4 (search, view-profile, contact, history) | Built, not tested |
| employer | 7 | 5 (dashboard, team, member, top, retention) | Built, not tested |
| subscription | 8 | 4 (checkout, me, cancel, webhook) | Built, Stripe checkout verified working |
| reference | 7 | 4 (opt-in, withdraw, request, by-profile) | Built, not tested |

### Frontend Apps
| App | Tech | Pages | Status |
|---|---|---|---|
| **Web** (QR review) | React 19 + Vite + Tailwind | 1 route (/r/:slug) with 5 steps | Built, deployed, Playwright-verified |
| **UI** (Dashboard) | React 19 + Vite + Tailwind | Login, Dashboard, Profile, 404 | Built, deployed, Playwright-verified |
| **Mobile** | Expo (blank TypeScript) | Default blank app | Scaffold only, AAB uploaded to Play Console |

### Tests (12 files)
| Type | Files | Tests | Status |
|---|---|---|---|
| Unit | 6 | 133 | Written, **failing in CI** (mock/import issues) |
| Integration | 2 | 18 | Written, **failing in CI** (auth flow mismatches) |
| E2E | 1 | 9 | Written, not run in CI |
| Utils | 3 | - | Factories + setup |

---

## 2. What's Working (Verified)

### Cloud Run Services (6 services, 2 environments)

| Service | Dev URL | Staging URL | Health |
|---|---|---|---|
| API | https://review-api-dev-1049089489429.asia-southeast1.run.app | https://review-api-staging-1049089489429.asia-southeast1.run.app | Passing |
| Web | https://review-web-dev-1049089489429.asia-southeast1.run.app | https://review-web-staging-1049089489429.asia-southeast1.run.app | Passing |
| UI | https://review-ui-dev-1049089489429.asia-southeast1.run.app | https://review-ui-staging-1049089489429.asia-southeast1.run.app | Passing |

### API Endpoints (Verified on Cloud Run)
- `GET /health` — returns `{"ok":true}`
- `GET /api/v1/qualities` — returns 5 qualities (Expertise, Care, Delivery, Initiative, Trust)
- `GET /api/v1/profiles/:slug` — returns profile with quality breakdown, review count
- `GET /api/v1/reviews/profile/:profileId` — returns paginated reviews
- `POST /api/v1/reviews/scan/:slug` — generates review token (QR scan flow)
- `POST /api/v1/reviews/submit` — creates review with quality picks
- `POST /api/v1/subscriptions/checkout` — creates Stripe checkout session ($10/month Pro verified)

### Seed Data on Cloud SQL
| Entity | Count | Verified |
|---|---|---|
| Users | 12 | Yes |
| Organizations | 6 | Yes |
| Profiles | 6 | Yes (ramesh-kumar: 150, sarah-williams: 200, etc.) |
| Reviews | 517 | Yes |
| Media records | ~310 | Yes |
| Verifiable references | 103 | Yes |
| Qualities | 5 | Yes |
| Subscriptions | 3 | Yes |

### Stripe (Arus Innovation Pte Ltd sandbox)
| Product | Prices | Checkout Verified |
|---|---|---|
| Pro Individual | $10/month, $60/year | Yes — session created, Stripe dashboard confirmed |
| Employer Dashboard | $50, $100, $200/month | Prices created, not tested |
| Recruiter Access | $500, $1,000/month | Prices created, not tested |

### Playwright Verification (localhost)
- Web app loads at /r/ramesh-kumar with 5 quality chips + submit button
- UI app loads with login page (4 buttons: Sign In, Individual, Employer, Recruiter)
- Profile pages load for all 6 seeded individuals
- API endpoints return correct data

---

## 3. What's NOT Working

### CI Pipeline (Failing)
**Status:** CI runs on push to main but **fails** on every push.

**Root cause:** Tests written by parallel agents don't match the final code:
- Unit tests: mock setup doesn't match actual service constructors
- Integration tests: auth flow tests send wrong request shapes (validation fails)
- Rate limiting in tests: requests get 429 instead of expected status codes

**Impact:** CI is red but doesn't block deploys (deploy workflows are independent).

**Fix needed:** Update test files to match actual controller/service/validation code.

### Firebase Auth (Not Functional)
- Firebase Admin SDK initializes but there are no real Firebase users
- Auth endpoints (register, login) are built but **not tested end-to-end**
- Dashboard UI has "Dev Login" buttons but the API doesn't have a dev-login endpoint
- No Firebase project configured for user management

**Fix needed:** Either create Firebase Auth users or add a dev-login bypass endpoint.

### Media Upload (Not Tested)
- Media module is built with multer config and GCS upload logic
- Voice/video upload flow not tested end-to-end
- GCS bucket exists (`humini-review-media-dev`) but no files uploaded
- Transcoding pipeline (FFmpeg Cloud Run job) not implemented

### Mobile App (Scaffold Only)
- Expo app created with `sg.reviewapp.app` package
- AAB built and uploaded to Play Console internal track as **draft**
- **App is a blank default Expo screen** — no review flow, no profile, no QR scanner
- Play Console internal testing track is **inactive** (no testers selected)

### Play Console Setup (Incomplete)
| Task | Status |
|---|---|
| Privacy policy | Done |
| App access | Done |
| Ads | Done |
| Content rating | Done (12+ / Teen) |
| Target audience | Done (18+) |
| Government apps | Done |
| Financial features | Done |
| Health | Done |
| **Data safety** | **Not done** |
| **App category + contacts** | **Not done** |
| **Store listing** | **Not done** (no description, no screenshots) |

Data safety, app category, and store listing are **not required for internal testing** but needed before production.

---

## 4. GCP Infrastructure

| Resource | Name | Status |
|---|---|---|
| Cloud SQL | review-db-dev (Postgres 16, db-f1-micro) | Running, 35.185.181.255 |
| Cloud Storage | humini-review-media-dev | Created, empty |
| Artifact Registry | review-apps | Active, images pushed |
| Secret Manager | 7 secrets | All set |
| Service Account | review-deployer | 6 IAM roles |
| Service Account | eas-submit | Play Console access |

### Secret Manager Contents
| Secret | Purpose | Status |
|---|---|---|
| review-jwt-secret | JWT signing | Set |
| review-db-password | Cloud SQL password | Set |
| review-db-host | Cloud SQL IP | Set |
| review-db-name | Database name | Set |
| review-db-user | Database user | Set |
| review-stripe-secret | Stripe API key (real test key) | Set |
| review-stripe-webhook-secret | Stripe webhook secret | Placeholder |

---

## 5. GitHub Secrets

| Secret | Status |
|---|---|
| GCP_PROJECT_ID | Set (`humini-review`) |
| GCP_SA_KEY | Set (review-deployer SA key) |
| CLOUDSQL_CONNECTION_NAME | Set |
| GOOGLE_PLAY_SA_KEY | Set (eas-submit SA key) |
| **EXPO_TOKEN** | **NOT SET** — needed for deploy-mobile workflow |

---

## 6. GitHub Workflows

| Workflow | Trigger | Status |
|---|---|---|
| `ci.yml` | Push to main + PRs | Running but **failing** (test issues) |
| `deploy-staging.yml` | Manual (workflow_dispatch) | **Working** — last run succeeded |
| `deploy-prod.yml` | Manual (workflow_dispatch) | Not tested yet |
| `deploy-mobile.yml` | Manual (workflow_dispatch) | Created, **EXPO_TOKEN not set** |

---

## 7. Taskfile Commands

```
# Local (docker postgres)
task local:server              # Start dev server
task local:migrate             # Run migrations
task local:seed                # Seed data
task local:psql                # Connect to local postgres
task local:stripe:listen       # Forward Stripe webhooks
task local:test                # Run tests
task local:build               # TypeScript check

# Dev (Cloud SQL + Cloud Run)
task dev:startproxy            # Cloud SQL proxy on :6199
task dev:psql                  # Connect to Cloud SQL
task dev:migrate               # Run migrations on Cloud SQL
task dev:seed                  # Seed Cloud SQL
task dev:deploy:api            # Deploy API
task dev:deploy:web            # Deploy Web
task dev:deploy:ui             # Deploy UI
task dev:deploy:all            # Deploy everything
task dev:deploy:mobile         # Build + submit to Play Store
task dev:deploy:mobile:preview # Build preview APK
task dev:logs:api              # View API logs
task dev:status                # Show Cloud Run services
task dev:health                # Health check
```

---

## 8. Priority Fixes (Recommended Order)

### P0 — Must fix for functional beta
1. **Fix CI tests** — Update unit/integration tests to match actual code. CI should be green.
2. **Add Firebase Auth or dev-login bypass** — Dashboard UI needs a working login flow.
3. **Build mobile app screens** — Replace blank Expo app with actual QR scanner + review flow.

### P1 — Needed before user testing
4. **Complete Play Console** — Data safety, app category, store listing.
5. **Set EXPO_TOKEN** — GitHub secret for mobile deploy workflow.
6. **Stripe webhook** — Set up `stripe listen` forwarding or configure webhook URL on deployed API.
7. **Test media upload** — Verify voice/video upload to GCS works end-to-end.

### P2 — Before production
8. **Privacy policy page** — Create actual /privacy page in UI app (currently returns 404).
9. **Video transcoding** — Implement FFmpeg Cloud Run job for 720p→480p.
10. **Production deploy** — Test deploy-prod workflow, set up prod database + secrets.

---

## 9. Cost Estimate (Current Dev Environment)

| Resource | Monthly Est. |
|---|---|
| Cloud SQL (db-f1-micro) | ~$7 |
| Cloud Run (6 services, min 0) | ~$0-10 |
| Cloud Storage (<1GB) | ~$0.02 |
| Secret Manager (7 secrets) | ~$0.42 |
| Artifact Registry (<5GB) | ~$0.50 |
| **Total** | **~$8-18/month** |
