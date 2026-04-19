---
status: completed
slug: 25-reviewee-photo
handoff_from: muthuishere
date: 2026-04-18
packages: [api, ui, web]
off_limits:
  - apps/mobile/**
test_frameworks:
  api: vitest
  ui: vitest
  web: vitest
project_context: ~/config/muthuishere-agent-skills/review-app/project.md
---

## Task

Show the reviewee's photo on both the QR-scan review flow (`apps/web` at
`review-scan.teczeed.com/r/:slug`) and the public profile page (`apps/ui` at
`review-profile.teczeed.com/profile/:slug`). Source the photo from
`users.avatar_url` — already captured from Google sign-in. Fallback to the
existing initials-on-gradient avatar (see `apps/ui/src/components/ProfileCard.tsx`)
when `avatar_url` is null.

Goal in plain language: when a customer scans Ramesh's QR code, they should
see Ramesh's face above the quality chips so they know they're reviewing the
right person before they tap.

## Acceptance Criteria

### AC1 — API exposes `photoUrl` on public profile response

`GET /api/v1/profiles/:slug` MUST include a new field `photoUrl: string | null`
sourced from the joined `users.avatar_url`. The profile repo already eager-loads
`user`; update `profile.service.ts` `toPublicResponse` and `toResponse` to
emit `photoUrl: profile.user?.avatarUrl ?? null`.

Same for `GET /api/v1/profiles/me` response.

### AC2 — API exposes photo on scan response

`POST /api/v1/reviews/scan/:slug` response's `profile` block MUST fix
two things at once (cited in `apps/api/src/modules/review/review.service.ts:56-63`):

```ts
profile: {
  id: string,
  name: string,        // user.displayName (person's name — currently hardcoded to profile.headline)
  headline: string | null,  // profile.headline (role/job title)
  photoUrl: string | null,  // user.avatarUrl
}
```

Spec 19 B2 fixed this class of bug on `/profiles/:slug` but never
propagated to the scan flow. Fix here too.

The review repo's `findBySlug` or equivalent must eager-load the
`user` association so `avatarUrl` + `displayName` are available.

### AC3 — Shared Avatar component in `apps/ui`

Create `apps/ui/src/components/Avatar.tsx` — a single component that
accepts `{ name: string; photoUrl?: string | null; size?: 'sm'|'md'|'lg'|'xl' }`.
Renders `<img>` with `alt={name}` when `photoUrl` is truthy and loads
successfully; falls back to initials-on-gradient (current `ProfileCard`
logic) otherwise. Handle image `onError` by switching to the initials
fallback so a broken URL never shows a broken image icon.

Then refactor `ProfileCard.tsx` to consume `<Avatar name={profile.name} photoUrl={profile.photoUrl} size="lg" />`.

### AC4 — Shared Avatar component in `apps/web`

Create the equivalent `apps/web/src/components/Avatar.tsx` (web is a
separate Vite app; don't add a shared workspace package — MVP scope).
Same props + behaviour. Import from the scan page.

### AC5 — Scan page renders the photo

On `apps/web`, the scan-flow landing page (`/r/:slug`) MUST render the
reviewee's photo prominently above the quality chips, with `name` and
`headline` beneath. Size: large enough to recognise a face (`size="xl"`,
~96–128px). When `photoUrl` is null, show the initials fallback in the
same shape/size. The photo area links to nothing — it's purely identity
confirmation.

### AC6 — Public profile page uses the Avatar too

`apps/ui/src/pages/ProfilePage.tsx` via `ProfileCard.tsx` MUST render the
same `<Avatar>` for the public profile. Consistent with scan page.

### AC7 — Tests (vitest)

**`apps/api`** — extend existing mobile-contract or profile tests:
- `GET /profiles/:slug` includes `photoUrl` (string when user.avatarUrl
  set, `null` when not)
- `POST /reviews/scan/:slug` response includes `name` (displayName),
  `headline`, `photoUrl` (regression guard for spec 19 B2 on scan path)

**`apps/ui`** — co-located `Avatar.test.tsx`:
- renders `<img>` with correct `src` + `alt` when `photoUrl` provided
- falls back to initials text when `photoUrl` is missing
- falls back to initials on image `onError`
- extend `ProfilePage.test.tsx` to assert the avatar element appears in the
  rendered DOM when API mock returns `photoUrl`

**`apps/web`** — if vitest isn't already wired there, add the same
minimal setup (vitest + @testing-library/react + jsdom + `test` script).
Then co-located `Avatar.test.tsx` with equivalent assertions, plus at
least one scan-page test asserting the photo renders.

### AC8 — Seed data gets reasonable demo photos

So the demo looks good, set `avatar_url` on the 6 visible seeded users
(ramesh, sarah, priya, david, lisa, ahmed) to a deterministic
placeholder URL using a free service that doesn't require API keys — e.g.
`https://i.pravatar.cc/300?u={slug}` or `https://ui-avatars.com/api/?name={url-encoded-name}&size=300`.
Prefer `ui-avatars.com` to avoid real human stock photos. Update the
seed in `apps/api/src/db/seeds/20260414-0001-demo-data.ts`.

### AC9 — No new deps, no schema change

- `users.avatar_url` column already exists — don't touch the schema.
- No new runtime deps. Test tooling only if `apps/web` didn't already
  have vitest.
- `apps/ui` already has vitest + @testing-library from spec 24; reuse.

## Context from Huddle

- User explicitly said: "pull User.avatarUrl already captured from Google
  sign-in and fallback with initials avatar and use it across" — meaning
  scan AND public profile.
- User also noted: deployed dev scan page returns `name = headline`,
  which is spec 19 B2 recurring on the scan endpoint. This spec cleans
  both up at once (AC2).
- There's a parallel infra fix in flight (track A) for `VITE_FEATURE_EMAIL_LOGIN=true`
  on dev — not related to this spec, ignore it.
- No self-service email/password signup is being added. Spec 16 is
  unchanged.

## Style Stance

- Error handling: API throws typed `AppError`s already; keep pattern
- Validation boundary: n/a, we're reading existing data
- Async style: async/await + React Query in UI; async/await in API
- Logging: existing logger in API; no UI logging
- Naming: camelCase on the wire (matches API convention)
- File layout: co-located `*.test.tsx` next to source
- Test style: invoke-and-validate; mock `apiFetch` / request boundary,
  not the network
- Mocking: in API tests, use the existing supertest + Testcontainers
  harness if present; do NOT introduce a new mocking framework
- Dependencies: zero new deps beyond vitest+testing-library for
  `apps/web` if needed
- Scope envelope: MVP — seed photos, avatar component, wire through
  API and both UIs. No upload flow. No crop. No EXIF stripping.
- Docs: update `docs/specs/25-reviewee-photo/spec.md`; no README changes

## Project Context

Monorepo:
- `apps/api` — Node 23 + Express + Sequelize + Postgres. Entry
  `src/server.ts`. Profile endpoint at `modules/profile/`. Review/scan
  at `modules/review/`.
- `apps/ui` — React 19 + Vite + Tailwind + React Query. Hosts
  `review-dashboard.teczeed.com` (logged-in) + `review-profile.teczeed.com`
  (public, via host-switching).
- `apps/web` — React + Vite + Tailwind. The QR scan + review flow at
  `review-scan.teczeed.com`.

The Profile model's User association is already defined
(`apps/api/src/config/sequelize.ts:143-144` — `Profile.belongsTo(User, { as: 'user' })`).

## Artifacts (filled in as Sreyash works)

- Spec: docs/specs/25-reviewee-photo/spec.md

- Tests:
  - apps/api/tests/integration/photo-url.test.ts (new, 3 tests, green)
  - apps/ui/src/components/Avatar.test.tsx (new, 6 tests, green)
  - apps/ui/src/pages/ProfilePage.test.tsx (extended +2, green)
  - apps/web/src/components/Avatar.test.tsx (new, 4 tests, green)
  - apps/web/src/pages/ReviewPage.test.tsx (new, 2 tests, green)

- Code:
  - apps/api/src/modules/profile/profile.service.ts (photoUrl in toResponse + toPublicResponse)
  - apps/api/src/modules/review/review.service.ts (scan returns name=displayName, headline, photoUrl)
  - apps/api/src/modules/review/review.types.ts (ScanResponse: + headline, + photoUrl)
  - apps/api/src/db/seeds/20260414-0001-demo-data.ts (INDIVIDUAL users get ui-avatars.com URL)
  - apps/ui/src/components/Avatar.tsx (new, shared)
  - apps/ui/src/components/ProfileCard.tsx (uses Avatar)
  - apps/ui/src/lib/api.ts (Profile.photoUrl)
  - apps/web/src/components/Avatar.tsx (new, duplicate)
  - apps/web/src/pages/ReviewPage.tsx (uses Avatar size=xl, adds headline)
  - apps/web/vitest.config.ts (new — jsdom + setup)
  - apps/web/src/test/setup.ts (new)
  - apps/web/package.json (test scripts + @testing-library + jsdom devDeps)

- Assumptions:
  - Demo seed avatar URLs: `https://ui-avatars.com/api/?name={URL-encoded-name}&size=300&background=random` applied to ALL INDIVIDUAL role users (covers the 6 named demo users plus any other INDIVIDUAL in seed-config.json). Employers/recruiters/admins left null.
  - ScanResponse.name was previously `profile.headline`. Changed to `user.displayName` per spec 19 B2 applied to scan path. This is a wire-format change — any mobile client that read `profile.name` as "role title" will break; the mobile app out of scope here is not re-checked.
  - Avatar component duplicated (not a shared workspace package) per explicit MVP instruction.
  - apps/web's ReviewPage header is restructured from horizontal (small avatar + name/role) to vertical-centred (xl avatar on top, name, headline below) to meet AC5's "prominently above the quality chips, large enough to recognise a face". Existing `profile.role` / `profile.orgName` parsing kept as fallbacks so nothing silently breaks.
  - `Profile` in apps/ui/src/lib/api.ts now has `photoUrl?: string | null`. Did not touch the legacy snake_case fields.
  - `onError` fallback uses React state (`broken`); no new deps.

- Blockers: none.
