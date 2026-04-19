# Spec 16: Authentication & User Management Strategy

**Project:** ReviewApp
**Date:** 2026-04-16 (amended 2026-04-18 — email+password testing-only, UnifiedAuth UX added; amended 2026-04-19 — mobile `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN` wired into deploy-mobile.yml so the flag actually reaches the bundle)
**Firebase Project:** humini-review
**Decisions:** d11-d14, d19 (email+password testing-only) from huddle

---

## 1. Auth Strategy

Dual authentication — Google (Firebase) for public registration, email+password (bcrypt-in-our-own-users-table, reqsume-style) for admin-managed accounts.

| Provider | Who uses it | Registration | Login | Password store |
|---|---|---|---|---|
| **Google (Firebase)** | All public users | Yes — only way to self-register | `POST /auth/exchange-token` | Firebase |
| **Email/Password (internal)** | Admin-created accounts + testing | **No public signup — admin creates via `POST /auth/admin/create-user`** | `POST /auth/login` | `users.password_hash` (bcrypt, 12 rounds) |

### 1.1 Why two separate password stores

The two providers don't converge on Firebase. Google sign-in uses Firebase OAuth and produces a Firebase ID token that `/auth/exchange-token` verifies with the Firebase Admin SDK. Email+password users live **only** in our `users` table — Firebase is not involved at all. `POST /auth/login` looks up the row by email and `bcrypt.compare` against `password_hash`. This mirrors reqsume's pattern (`/apps/api/src/services/user.go` — `RegisterUser` / `Login`) and keeps the two paths completely independent: a Firebase outage doesn't break admin-provisioned accounts, and we don't need Firebase Admin SDK to create or reset a password user.

### 1.2 Email+password scope — testing-first

Email+password is **primarily a testing convenience**. It may never ship to production as a user-facing feature. Treating it as testing-first lets us skip:

- Force-password-reset-on-first-sign-in for admin-provisioned accounts
- Email-based password reset flow
- Password-strength meter in the UI
- Account lockout after N failed attempts
- Audit logging on sign-in

If promoted to production, add those. Until then, the admin uses `POST /auth/admin/create-user` with a known temp password, hands it to the tester, done.

## 1.2 UnifiedAuth UX (web + mobile)

Both web (`apps/ui`) and mobile (`apps/mobile`) render a **single unified auth screen** — Google is the primary action; email+password is a secondary affordance behind a feature flag. Pattern lifted from `reqsume/apps/ui/src/components/auth/UnifiedAuth.tsx`.

```
┌─────────────────────────────┐
│    Welcome to ReviewApp     │
│                             │
│  [ Continue with Google ]   │  ← primary button
│                             │
│  ───────── OR ─────────     │
│                             │
│  [ Continue with Apple ]    │  ← disabled / "coming soon"
│                             │
│  🔒 Secured with Firebase   │
│                             │
│  Sign in with email and     │  ← link, only shown if
│          password           │     FEATURE_EMAIL_LOGIN=true
└─────────────────────────────┘
```

Clicking the email+password link reveals an in-place `SignIn` form (email + password + submit). **No signup form anywhere in the public flow.**

### Feature flags

| Key | Scope | Default prod | Default dev |
|---|---|---|---|
| `VITE_FEATURE_EMAIL_LOGIN` | `apps/ui`, `apps/web` | `false` | `true` |
| `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN` | `apps/mobile` | `false` | `true` |

Both live in `.env.dev` (Vite / Expo build args — baked into the bundle at build time, same as other `VITE_*`/`EXPO_PUBLIC_*` keys).

## 2. Firebase Configuration

**Project:** humini-review
**Web App ID:** 1:1049089489429:web:5f0ab182785d1cf3f22c1c

### Frontend Config (VITE_ env vars)
```
VITE_FIREBASE_API_KEY=AIzaSyBAQ3fKCEiCn-z7VPG9jEzQ-XA9rCWBvhE
VITE_FIREBASE_AUTH_DOMAIN=humini-review.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=humini-review
VITE_FIREBASE_STORAGE_BUCKET=humini-review.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1049089489429
VITE_FIREBASE_APP_ID=1:1049089489429:web:5f0ab182785d1cf3f22c1c
VITE_FIREBASE_MEASUREMENT_ID=G-4DBF9D03B4
```

### Backend Config
- Firebase Admin SDK service account: `firebase-adminsdk-fbsvc@humini-review.iam.gserviceaccount.com`
- Key file: `apps/api/firebase-service-account.json` (gitignored)
- In production: stored in Secret Manager as `review-firebase-sa-key`

## 3. User Roles

| Role | How assigned | Features |
|---|---|---|
| **INDIVIDUAL** | Auto on Google sign-in | Own profile, collect reviews, QR code, share publicly or private |
| **EMPLOYER** | Request + admin approve + subscription | Team dashboard, top performers, retention signals |
| **RECRUITER** | Request + admin approve + subscription | Search profiles, contact individuals, verifiable references |
| **ADMIN** | Manual assignment only | Full access, approve role requests, manage users |

## 4. Auth Flows

### Flow 1: Google Sign-In (Public Registration + Login)

```
User clicks "Sign in with Google"
    ↓
Firebase popup → Google account selected → Firebase ID token
    ↓
Frontend: POST /api/v1/auth/exchange-token { firebaseToken }
    ↓
API: Firebase Admin verifyIdToken(firebaseToken)
    ↓
Extract: email, displayName, photoURL, firebaseUid
    ↓
Find user by firebaseUid or email
    ├── Found → update lastLoginAt, issue JWT
    └── Not found → create user (role: INDIVIDUAL, status: active, provider: google)
    ↓
Return: { accessToken (JWT HS256, 24h), user: { id, email, name, role, tier } }
    ↓
Frontend: store token in localStorage, redirect to /dashboard
```

### Flow 2: Email/Password Login (Admin-Created Accounts — testing-first)

Reqsume-style — our backend owns the password. Firebase is not involved in this flow.

```
Admin provisions user: POST /api/v1/auth/admin/create-user
    body: { email, password, name, role }
    ↓
API: bcrypt.hash(password, 12) → insert users row
    { provider: 'internal', passwordHash, role, status: 'active' }
    ↓
Admin hands the temp password to the user

⸺

User enters email+password in UnifiedAuth (email+password affordance shown by feature flag)
    ↓
Frontend: POST /api/v1/auth/login { email, password }   ← bcrypt path, not exchange-token
    ↓
API: find user by email, reject if provider != 'internal',
     bcrypt.compare(password, user.passwordHash)
    ↓
Return: { accessToken (JWT), user }
```

**Deliberately skipped for now (deferred until promoted to production):**

- Password-reset-via-email
- Force-reset-on-first-sign-in for admin-provisioned accounts
- Account lockout after N failed attempts
- Password-strength meter
- Audit logging on password sign-in

### Flow 3: Role Upgrade Request

```
INDIVIDUAL user wants EMPLOYER access
    ↓
POST /api/v1/auth/role-request { requestedRole, companyName, companyWebsite, reason }
    ↓
API: create role_request record (status: pending)
    ↓
Admin sees pending requests: GET /api/v1/auth/admin/role-requests
    ↓
Admin approves: POST /api/v1/auth/admin/role-requests/:id/approve
    ↓
User role updated to EMPLOYER
    ↓
User subscribes: POST /api/v1/subscriptions/checkout { tier: employer_small }
    ↓
Features unlocked
```

## 5. API Endpoints

### Public
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/exchange-token` | Firebase ID token (Google OAuth) → JWT |
| POST | `/auth/login` | Email+password (bcrypt against `users.password_hash`) → JWT |

### Authenticated (any role)
| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/me` | Get current user |
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/role-request` | Request role upgrade |
| GET | `/auth/role-request/me` | Check my pending request |

### Admin only
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/admin/create-user` | Create email+password user (bcrypt hash into `users`, `provider: 'internal'`) |
| GET | `/auth/admin/role-requests` | List pending role requests |
| POST | `/auth/admin/role-requests/:id/approve` | Approve role request |
| POST | `/auth/admin/role-requests/:id/reject` | Reject role request |
| GET | `/auth/admin/users` | List all users |
| PATCH | `/auth/admin/users/:id/role` | Manually change role |
| PATCH | `/auth/admin/users/:id/status` | Activate/suspend user |

## 6. Database

### Users table (existing — add fields)
```
provider         VARCHAR(20)  DEFAULT 'google'    -- google | internal
firebase_uid     VARCHAR(128) UNIQUE              -- Firebase UID (null for internal users)
password_hash    VARCHAR(255)                      -- bcrypt hash (null for Google users; reqsume-style)
avatar_url       VARCHAR(512)                      -- from Google profile (null for internal users)
```

### Role Requests table (new)
```
role_requests
├── id              UUID PRIMARY KEY
├── user_id         UUID FK → users
├── requested_role  VARCHAR(20) -- EMPLOYER | RECRUITER
├── company_name    VARCHAR(255)
├── company_website VARCHAR(255)
├── reason          TEXT
├── status          VARCHAR(20) DEFAULT 'pending' -- pending | approved | rejected
├── reviewed_by     UUID FK → users (admin)
├── reviewed_at     TIMESTAMP
├── created_at      TIMESTAMP
└── updated_at      TIMESTAMP
```

## 7. JWT Claims

```json
{
  "sub": "user-uuid",
  "email": "user@gmail.com",
  "role": "INDIVIDUAL",
  "tier": "free",
  "status": "active",
  "provider": "google",
  "iat": 1776268459,
  "exp": 1776354859
}
```

- Algorithm: HS256
- Secret: from `JWT_SECRET` env var / Secret Manager
- Expiry: 24 hours

## 8. Security Rules

- Google registration only — no public email/password signup
- Firebase ID token verified server-side via Admin SDK (not trusted client-side) — provider-agnostic
- Email+password accounts: **bcrypt hash in our own `users` table** (reqsume-style); 12 rounds. Admin-provisioned via `POST /auth/admin/create-user`. Testing-first.
- Email+password UI gated by `VITE_FEATURE_EMAIL_LOGIN` / `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN` — off by default in production.
- Role upgrade requires admin approval — no self-promotion
- EMPLOYER/RECRUITER features gated by both role AND active subscription
- Suspended users (status != active) blocked at middleware level
- JWT includes role + tier — middleware checks both for paid features
