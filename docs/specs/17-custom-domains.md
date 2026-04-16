# Spec 17: Custom Domains & Routing Plan

**Project:** review-app
**Primary Domain:** `teczeed.com`
**Date:** 2026-04-16
**Status:** Draft

---

## 1. Goal

Expose the product on descriptive subdomains under `teczeed.com` instead of generic service names.

The domain names should describe the user job:

- `review-scan.teczeed.com` for QR-driven customer review submission
- `review-profile.teczeed.com` for public reputation/profile viewing
- `review-dashboard.teczeed.com` for signed-in workspace use

The API should not be exposed as a public branded subdomain for this phase.

---

## 2. Current Repo Reality

The current deployable surfaces are:

| Surface | Repo App | Current Primary Routes | Audience |
|---|---|---|---|
| Review flow | `apps/web` | `/r/:slug` | Customers leaving reviews |
| Dashboard + public profile | `apps/ui` | `/login`, `/dashboard`, `/profile/:slug` | Individuals, employers, recruiters, public viewers |
| Backend API | `apps/api` | `/api/v1/*` | Internal service for both frontends |

### Important constraint

`review-profile.teczeed.com` and `review-dashboard.teczeed.com` map to the same frontend service today: `apps/ui`.

That means:

- the domain split can be done immediately at DNS / Cloud Run level
- the ideal root-domain behavior still needs small frontend routing work

Examples:

- `https://review-dashboard.teczeed.com/` can cleanly land on `/dashboard`
- `https://review-profile.teczeed.com/profile/ramesh-kumar` works now
- `https://review-profile.teczeed.com/` does **not** yet have a dedicated profile-style landing experience

---

## 3. Target Hostname Design

### 3.1 Production Hostnames

| Hostname | Purpose | Target Cloud Run Service |
|---|---|---|
| `review-scan.teczeed.com` | Mobile QR review flow | `review-web-*` |
| `review-profile.teczeed.com` | Public profile pages and shared reputation links | `review-ui-*` |
| `review-dashboard.teczeed.com` | Logged-in workspace for individuals, employers, recruiters | `review-ui-*` |

### 3.2 Why these names

- `review-scan` says exactly what triggers the flow
- `review-profile` says exactly what the public viewer sees
- `review-dashboard` is accurate for the current shared signed-in app

### 3.3 Explicit non-goals

- No public `api.teczeed.com`
- No recruiter-only subdomain yet
- No employer-only subdomain yet
- No separate profile frontend split in this phase

---

## 4. Routing Model

### 4.1 Immediate mapping

#### Host 1: `review-scan.teczeed.com`

- Maps to Cloud Run service: `review-web-dev` / `review-web-staging` / future prod equivalent
- Primary route remains `/r/:slug`
- QR codes should use this host directly

Example:

```text
https://review-scan.teczeed.com/r/ramesh-kumar
```

#### Host 2: `review-profile.teczeed.com`

- Maps to the UI Cloud Run service
- Public profile links live under `/profile/:slug`

Example:

```text
https://review-profile.teczeed.com/profile/ramesh-kumar
```

#### Host 3: `review-dashboard.teczeed.com`

- Maps to the same UI Cloud Run service
- Login and authenticated flows live here

Examples:

```text
https://review-dashboard.teczeed.com/login
https://review-dashboard.teczeed.com/dashboard
```

### 4.2 Small polish work required after mapping

To make the domains feel intentional, add host-aware routing rules in `apps/ui`:

- `review-dashboard.teczeed.com/` -> redirect to `/dashboard` or `/login`
- `review-profile.teczeed.com/` -> redirect to a public landing page or a profile-search/share page
- optionally block dashboard UI from being the default experience on the profile host

This is a frontend routing improvement, not an infrastructure blocker.

---

## 5. DNS & Cloudflare Strategy

### 5.1 DNS records

Create one DNS record per hostname in Cloudflare:

- `review-scan`
- `review-profile`
- `review-dashboard`

Point each record to the target provided by Google during domain mapping.

### 5.2 Proxy mode

For initial setup:

- set records to `DNS only`
- do not enable Cloudflare proxy until Google-managed certificates are issued and stable

### 5.3 Why `DNS only` first

Cloud Run custom domain verification and certificate provisioning are more predictable when Cloudflare is not proxying or flattening the validation path during first-time setup.

---

## 6. Cloud Run Mapping Strategy

### 6.1 Phase 1: Direct custom domain mapping

Use Cloud Run custom domain mappings for the three hosts above.

This is the fastest path because:

- the services already exist
- no load balancer configuration is required to get live URLs
- it matches the current repo structure

### 6.2 Phase 2: External HTTPS Load Balancer

Move to a Google external HTTPS Load Balancer later if any of the following become important:

- same-origin API routing
- edge security policies
- centralized TLS / redirects
- path-based routing across services
- cleaner hiding of backend service URLs

For now, the direct mapping route is acceptable because the user goal is descriptive branded URLs, not a full ingress redesign.

---

## 7. API Exposure Strategy

The backend remains a service dependency, not a user-facing brand surface.

### Phase 1

- keep API on its existing Cloud Run URL
- frontends continue using configured API base URLs
- do not publish `api.teczeed.com`

### Phase 2

If same-origin behavior is needed, route API traffic behind the dashboard/profile host through a load balancer:

- `review-dashboard.teczeed.com/api/v1/*`
- `review-profile.teczeed.com/api/v1/*`

This is optional and should not block hostname rollout.

---

## 8. Environment Strategy

Do **not** use the production `teczeed.com` names for dev experiments.

Recommended environment approach:

| Environment | Recommendation |
|---|---|
| Dev | Keep `*.run.app` URLs |
| Staging | Optional prefixed subdomains like `staging-review-scan.teczeed.com` |
| Production | Use `review-scan`, `review-profile`, `review-dashboard` |

This avoids accidental production-domain confusion while the app is still evolving.

---

## 9. Rollout Plan

### Step 1: Confirm production service names

Decide the exact production Cloud Run service names for:

- review web
- UI
- API

### Step 2: Map domains

Create the three custom domain mappings:

- `review-scan.teczeed.com` -> review web service
- `review-profile.teczeed.com` -> UI service
- `review-dashboard.teczeed.com` -> UI service

### Step 3: Add DNS in Cloudflare

Add the Google-provided DNS records in Cloudflare as `DNS only`.

### Step 4: Wait for certificate provisioning

Do not test through proxying until Google-managed TLS is active.

### Step 5: Smoke test

Verify:

- `review-scan.teczeed.com/r/<slug>`
- `review-profile.teczeed.com/profile/<slug>`
- `review-dashboard.teczeed.com/login`
- `review-dashboard.teczeed.com/dashboard`

### Step 6: Add routing polish in `apps/ui`

Implement host-aware redirects so root URLs behave intentionally.

### Step 7: Optional hardening

After validation:

- enable Cloudflare proxy if desired
- consider WAF / caching rules
- consider moving to load balancer-based ingress

---

## 10. Acceptance Criteria

The rollout is complete when:

- all three subdomains resolve with valid HTTPS
- the QR flow works on `review-scan.teczeed.com`
- public profiles work on `review-profile.teczeed.com`
- dashboard login works on `review-dashboard.teczeed.com`
- no public branded API hostname is introduced
- frontend routing gaps are documented even if not yet implemented

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Mapping both profile and dashboard to the same UI service causes awkward root behavior | Medium | Add host-aware redirects in `apps/ui` |
| Cloudflare proxy interferes with domain verification | Medium | Use `DNS only` during setup |
| Frontend still depends on API `run.app` origin | Low-Medium | Keep as-is for phase 1; move to load balancer later if needed |
| Production domain reused too early for non-prod testing | Medium | Keep dev on `run.app`, optionally use staging-prefixed subdomains |

---

## 12. Recommended Decision

Adopt the following production hostname set:

- `review-scan.teczeed.com`
- `review-profile.teczeed.com`
- `review-dashboard.teczeed.com`

Implement them first as direct Cloud Run custom domains, then decide later whether ingress should be upgraded to a Google external HTTPS Load Balancer.
