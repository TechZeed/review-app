# Spec 16: Authentication & User Management Strategy

**Project:** ReviewApp
**Date:** 2026-04-16
**Firebase Project:** humini-review
**Decisions:** d11-d14 from huddle

---

## 1. Auth Strategy

Dual authentication — Google (Firebase) for public registration, email/password (internal) for admin-managed accounts.

| Provider | Who uses it | Registration | Login |
|---|---|---|---|
| **Google (Firebase)** | All public users | Yes — only way to register | Yes |
| **Email/Password (internal)** | Admin-created accounts | No public signup — admin creates | Yes |

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

### Flow 2: Email/Password Login (Admin-Created Accounts)

```
Admin creates user: POST /api/v1/auth/admin/create-user { email, password, name, role }
    ↓
User logs in: POST /api/v1/auth/login { email, password }
    ↓
API: find user by email, bcrypt.compare(password, hash)
    ↓
Return: { accessToken (JWT), user }
```

No public registration endpoint for email/password.

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
| POST | `/auth/exchange-token` | Firebase token → JWT |
| POST | `/auth/login` | Email/password → JWT |

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
| POST | `/auth/admin/create-user` | Create email/password user |
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
firebase_uid     VARCHAR(128) UNIQUE              -- Firebase UID (null for internal)
password_hash    VARCHAR(255)                      -- bcrypt hash (null for Google users)
avatar_url       VARCHAR(512)                      -- from Google profile
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
- Firebase ID token verified server-side via Admin SDK (not trusted client-side)
- Email/password accounts: bcrypt with 12 rounds
- Role upgrade requires admin approval — no self-promotion
- EMPLOYER/RECRUITER features gated by both role AND active subscription
- Suspended users (status != active) blocked at middleware level
- JWT includes role + tier — middleware checks both for paid features
