# Spec 25 — Reviewee Photo

## Purpose

Show the reviewee's face at two identity-confirmation moments: the QR scan
landing page (`apps/web`, route `/r/:slug`, file `apps/web/src/pages/ReviewPage.tsx`)
and the public profile page (`apps/ui`, route `/profile/:slug`, file
`apps/ui/src/pages/ProfilePage.tsx` via `apps/ui/src/components/ProfileCard.tsx`).
Source the photo from the existing `users.avatar_url` column
(`apps/api/src/modules/auth/auth.model.ts`) already populated from Google
sign-in. Fall back to the current initials-on-gradient avatar when missing.

Also cleans up a recurring spec 19 B2 class bug on the scan endpoint
(`apps/api/src/modules/review/review.service.ts`): today `profile.name`
is set from `headline` (the role title) and `photo` is hardcoded `undefined`.

## Packages Affected

- `apps/api` — expose `photoUrl` on `/profiles/:slug`, `/profiles/me`, and
  `/reviews/scan/:slug` responses; demo seed populates avatar URLs.
- `apps/ui` — shared `<Avatar>` component; `ProfileCard` renders it.
- `apps/web` — shared `<Avatar>` component (duplicate, MVP scope — no
  workspace package); `ReviewPage` renders it prominently above the
  quality chips.

## ADDED Requirements

### Requirement: API — public profile response includes `photoUrl`

`GET /api/v1/profiles/:slug` MUST return a `photoUrl: string | null` field
sourced from the eager-loaded `user.avatarUrl`. Implemented in
`ProfileService.toPublicResponse` at
`apps/api/src/modules/profile/profile.service.ts`. The profile repo
(`apps/api/src/modules/profile/profile.repo.ts`) already eager-loads the
`user` association — no repo change needed.

#### Scenario: user has an avatar
- GIVEN a seeded public profile whose `users.avatar_url` is set to a URL
- WHEN the client `GET`s `/api/v1/profiles/:slug`
- THEN the response body contains `photoUrl` equal to that URL

#### Scenario: user has no avatar
- GIVEN a seeded public profile whose `users.avatar_url` is `null`
- WHEN the client `GET`s `/api/v1/profiles/:slug`
- THEN the response body contains `photoUrl: null`

### Requirement: API — `/profiles/me` includes `photoUrl`

`GET /api/v1/profiles/me` MUST return `photoUrl: string | null` (same
source as above). Implemented in `ProfileService.toResponse`.

#### Scenario: authenticated user fetches their own profile
- GIVEN an authenticated test user with no `avatar_url`
- WHEN the client `GET`s `/api/v1/profiles/me`
- THEN `photoUrl` is present in the response and is `null`

### Requirement: API — scan response includes correct name + headline + photoUrl

`POST /api/v1/reviews/scan/:slug` response's `profile` block MUST return:
- `name`: `user.displayName` (the person's name, not the role title)
- `headline`: `profile.headline` (the role title, or `null`)
- `photoUrl`: `user.avatarUrl` (or `null`)

Cited in `apps/api/src/modules/review/review.service.ts:53-63`. The
`ScanResponse` type in `apps/api/src/modules/review/review.types.ts` MUST
be updated to match. This fixes spec 19 B2 on the scan endpoint (was only
fixed on `/profiles/:slug`).

#### Scenario: scan returns the person's name, role, and photo
- GIVEN a seeded profile whose owner has `displayName = "Test Individual"`,
  `headline = "Fresh test profile"`, and `avatar_url = null`
- WHEN the client `POST`s `/api/v1/reviews/scan/:slug` with a valid device
  fingerprint
- THEN the response's `profile` block has `name = "Test Individual"`,
  `headline = "Fresh test profile"`, `photoUrl = null`

### Requirement: API — demo seed populates six visible avatar URLs

`apps/api/src/db/seeds/20260414-0001-demo-data.ts` MUST set `avatar_url`
for the six demo individuals (ramesh, priya, david, sarah, ahmed, lisa)
to a deterministic `https://ui-avatars.com/api/?name={URL-encoded-name}&size=300&background=random`
URL. Admins/employers/recruiters stay `null`.

#### Scenario: ramesh seed has a photo
- GIVEN the demo seed has run
- WHEN the dev DB is queried for `ramesh@reviewapp.demo`
- THEN `avatar_url` starts with `https://ui-avatars.com/api/?name=Ramesh%20Kumar`

### Requirement: apps/ui — shared Avatar component

`apps/ui/src/components/Avatar.tsx` MUST expose a default React component
with props `{ name: string; photoUrl?: string | null; size?: 'sm'|'md'|'lg'|'xl' }`.
It renders an `<img>` with `alt={name}` when `photoUrl` is a truthy
string; otherwise renders the initials-on-gradient fallback (lifted from
the current `ProfileCard` logic). On `<img>` `onError`, it MUST switch to
the initials fallback so a broken URL never shows a broken-image icon.

#### Scenario: renders photo when photoUrl provided
- GIVEN `<Avatar name="Ramesh Kumar" photoUrl="https://x/y.png" />`
- WHEN mounted
- THEN an `<img>` with `src="https://x/y.png"` and `alt="Ramesh Kumar"` is in the DOM

#### Scenario: falls back to initials when no photoUrl
- GIVEN `<Avatar name="Ramesh Kumar" />`
- WHEN mounted
- THEN the DOM contains the text `RK` and NO `<img>` element

#### Scenario: falls back on image load error
- GIVEN `<Avatar name="Ramesh Kumar" photoUrl="https://broken" />`
- WHEN the `<img>` fires `onError`
- THEN the component renders the initials fallback `RK`

### Requirement: apps/ui — ProfileCard uses Avatar

`apps/ui/src/components/ProfileCard.tsx` MUST render `<Avatar name={profile.name}
photoUrl={profile.photoUrl} size="lg" />` instead of the inline
initials-on-gradient block. `Profile` type in `apps/ui/src/lib/api.ts`
MUST include `photoUrl?: string | null`.

#### Scenario: ProfilePage shows avatar image when API returns photoUrl
- GIVEN the API mock returns a profile with `photoUrl = "https://p/q.png"`
- WHEN `ProfilePage` is rendered at `/profile/:slug`
- THEN an `<img>` with `src="https://p/q.png"` and `alt="Ramesh Kumar"` is in the DOM

### Requirement: apps/web — shared Avatar component

`apps/web/src/components/Avatar.tsx` MUST exist with the same props and
behaviour as the `apps/ui` version (duplicated — no workspace package).

#### Scenario: web Avatar renders photo
- GIVEN `<Avatar name="Priya" photoUrl="https://x/y.png" />`
- WHEN mounted
- THEN an `<img>` with `src="https://x/y.png"` is in the DOM

#### Scenario: web Avatar falls back to initials
- GIVEN `<Avatar name="Priya Sharma" />`
- WHEN mounted
- THEN the DOM contains `PS` and no `<img>`

### Requirement: apps/web — scan page renders Avatar prominently

`apps/web/src/pages/ReviewPage.tsx` MUST render `<Avatar
name={profile.name} photoUrl={profile.photoUrl} size="xl" />` above the
quality chips (the profile header area). `name` MUST come from the API
`name` field (display name), `headline` from `headline`.

#### Scenario: scan page shows photo when API returns photoUrl
- GIVEN the scan API mock returns `{ name: "Priya Sharma", headline: "Guest Relations", photoUrl: "https://x/y.png" }` on `GET /profiles/:slug`
- WHEN `ReviewPage` is rendered at `/r/priya-sharma`
- THEN an `<img>` with `src="https://x/y.png"` and `alt="Priya Sharma"` is in the DOM, and the text `Priya Sharma` and `Guest Relations` are visible

### Requirement: apps/web — vitest test harness exists

`apps/web` MUST have a vitest + @testing-library/react + jsdom setup
mirroring `apps/ui`: `vitest.config.ts`, `src/test/setup.ts`, and an
`npm test` script. No production dependencies change.

#### Scenario: npm test runs vitest
- GIVEN `cd apps/web`
- WHEN `npm test` is run
- THEN vitest discovers and runs `src/**/*.test.tsx` files
