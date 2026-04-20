# Spec 42 — Integration Testing Strategy

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-20
**Status:** Draft — documents the current testing topology and how a new test lands at the right layer.
**Supersedes / consolidates:** Spec 08 (general testing strategy, 2026-04-14), Spec 20 (integration tests on Testcontainers), Spec 25 (Playwright regression), Spec 35 (mobile Maestro), Spec 36 (regression CI), Spec 37 (OpenAPI pipeline). All remain authoritative for their individual concerns; this spec is the connective tissue.

---

## 1. Problem

Over four weeks we grew four distinct test layers, each serving a different failure mode. Without a map, new work keeps re-asking the same questions: *"Should this be a unit test? A Playwright flow? Maestro? Testcontainers?"*. This spec names each layer, what it catches, what it misses, and where a given failure type lands.

## 2. The five layers

From cheapest (fastest feedback, widest type of bug caught) to most expensive:

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER                   FEEDBACK        CATCHES                    │
├─────────────────────────────────────────────────────────────────────┤
│  1. TypeScript + OpenAPI compile-time    Contract drift, wrong      │
│     types (spec 37)     (~2s per save)   fields, missing params     │
│                                                                     │
│  2. Unit tests           (~5s per run)   Pure logic bugs, helper    │
│     per-module, no fetch                 functions, formatters      │
│                                                                     │
│  3. Integration tests    (~30s per run)  API ↔ DB contract:         │
│     Testcontainers       real Postgres,  SQL shape, migrations,     │
│     (spec 20)            mocked Firebase seed data                  │
│                                                                     │
│  4. Client-side MSW      (~5s per run)   UI consumes API correctly: │
│     unit + component                     type-safe mocks that fail  │
│     (specs 38-40)        mock API        at compile time on drift   │
│                                                                     │
│  5. Regression E2E       (~5-10 min)     Deployed-stack reality:    │
│     Playwright (spec 25) live dev API   Cloud Run booted, CORS ok,  │
│     Maestro (spec 35)    device/emu      real auth + real DB        │
└─────────────────────────────────────────────────────────────────────┘
```

Each layer is **composable**: a bug caught by layer 3 shouldn't need layer 5 to reproduce. Running the cheapest layer that catches a bug class is how feedback stays fast.

## 3. Layer-by-layer — what lives where

### 3.1 Layer 1 — TypeScript + OpenAPI types (the spine)

- **Source of truth:** `docs/openapi.yaml`, regenerated from Zod via `task dev:openapi:regen` (spec 37).
- **Consumers:** `apps/{web,ui,mobile,regression}/src/api-types.ts`, regenerated via each client's `npm run codegen` (specs 38-41).
- **Catches:** `client-typed-token vs API-returned-accessToken` class bugs. Field renames. Missing required params. Removed enum values.
- **Doesn't catch:** runtime logic errors, DB/migration mismatches, rendered-component bugs, real-deployment issues.
- **When you add work here:** any time you touch a Zod schema in `apps/api`. Run `task dev:openapi:regen`, then the clients' codegen. Drift surfaces as `tsc` failure.

### 3.2 Layer 2 — Pure unit tests

- **Where they live:** `apps/api/src/**/__tests__/*.test.ts` (vitest), per-client `src/__tests__/*.test.ts` (jest / vitest).
- **Catches:** logic bugs in helpers that don't cross a boundary. Formatters (`formatDate`, `maskPhone`), validators, utility functions, state reducers.
- **Doesn't catch:** anything involving a network call, DB, or DOM — those are layers 3/4/5.
- **Guideline:** if the test you want to write needs `fetch`, MSW, Testcontainers, or a Playwright page, it's not this layer.

### 3.3 Layer 3 — Integration tests (API ↔ DB)

- **Where they live:** `apps/api/tests/integration/**/*.test.ts` (spec 20).
- **Runtime:** Vitest with Testcontainers — real Postgres in Docker, mocked Firebase / GCP.
- **Catches:** SQL-shape mismatches, missing indexes, migration regressions, seed-data integrity, service-layer business logic that touches the repo.
- **Doesn't catch:** UI rendering, deployed-Cloud-Run misconfiguration, network path from client.
- **When you add work here:** any new repository method, migration, or service function that composes multiple queries. Covers the critical DB-write-then-read path cheaply.

### 3.4 Layer 4 — Client-side unit tests with MSW (specs 38-40)

- **Where they live:** `apps/mobile/lib/__tests__/`, `apps/web/src/__tests__/`, `apps/ui/src/__tests__/`.
- **Runtime:** Jest / Vitest in JSDOM (or `jest-expo` for mobile) + MSW mocking `fetch`.
- **Catches:**
  - Client-side logic around API responses — decoding, error handling, state transitions.
  - **Mock-shape contract:** MSW handlers are typed against the OpenAPI-generated types. A mock that returns the wrong shape fails `tsc` before the test ever runs.
  - Component-render-when-API-responds-with-X behaviour.
- **Doesn't catch:** real-auth bugs (MSW doesn't actually verify the JWT), real-DB bugs, real-deployment bugs.
- **When you add work here:** any new client code that consumes an API response shape. A one-line MSW mock + a one-line assert kills the class of drift bugs that bit us with the `accessToken` field.

### 3.5 Layer 5 — Regression E2E (specs 25, 35, 36)

- **Where they live:** `apps/regression/src/flows/*.spec.ts` (web, Playwright), `apps/regression/maestro/*.yaml` (mobile, Maestro).
- **Runtime:** CI (`.github/workflows/regression.yml`) + local (`task dev:test:regression`).
- **Catches:** deployed-stack issues — Cloud Run cold-start timeouts, CORS mismatches, real Firebase auth, Stripe webhook timing, Play Store APK actually launching. The compound reality that no earlier layer sees.
- **Doesn't catch:** fast feedback — regression runs in 5-10 min. Not a dev-loop tool. It's a deploy gate.
- **When you add work here:** one-per-user-journey, not one-per-function. Each flow should map to a PRD user story.

## 4. Decision tree — "where do I put this test?"

```
Does the thing being tested even exist in the OpenAPI spec?
├─ No  → add it (spec 37 §follow-ups) before writing a test against it
└─ Yes, proceed
   │
   Is it API-side (node) code?
   ├─ Yes, and it queries the DB → Layer 3 (Testcontainers)
   ├─ Yes, and it's a pure function → Layer 2 (unit)
   └─ No, proceed
      │
      Is it client-side logic that consumes an API?
      ├─ Yes → Layer 4 (MSW unit test in apps/web | apps/ui | apps/mobile)
      └─ No, proceed
         │
         Is it a user-visible journey that stitches multiple steps across
         deployed services?
         ├─ Yes → Layer 5 (regression: Playwright for web, Maestro for mobile)
         └─ No → it's probably a logic bug (Layer 2) that you haven't
                isolated yet. Try to reproduce in a unit before reaching
                for a bigger hammer.
```

## 5. What each bug in 2026-04 landed in

A few recent bugs mapped to the layer that actually caught them (or should have):

| Bug | Layer that caught it | Where it should have landed first |
|---|---|---|
| `accessToken` vs `token` on mobile login | Layer 5 (device) 😞 | Layer 1 (OpenAPI compile) — exact motivation for spec 37 |
| `DEFAULT_SEED_PASSWORD` fallback caused test login fails | Layer 5 (regression) | Layer 3 (seed idempotency should have had an integration test) |
| Recruiter search 500 (missing `recruiter_blocks` table) | Layer 5 + live API | Layer 3 — migration not applied to dev |
| Employer team empty (seed doesn't link org) | Layer 5 + live API | Layer 3 — seed-shape test |
| Quality heatmap aria-label parser mismatch | Layer 5 | Layer 4 — component MSW test with specific aria-label assertion |
| Scanner versionCode collision on Play | Manual "already submitted this version" | Layer 5 smoke-check after `deploy-mobile` (current spec 17 +`task dev:play:status`) |
| UI nav shows employer link incorrectly | Layer 5 | Layer 4 — unit test with MSW mock for `GET /subscriptions/me` returning specific capabilities |

**Interpretation**: we lean too much on Layer 5 because layers 1 + 4 weren't established until this week. Once specs 38-41 land, most of those bugs get caught 100-1000× cheaper.

## 6. CI topology

One workflow per layer (spec 36):

| Workflow | Layer(s) | Trigger |
|---|---|---|
| `ci.yml` (reusable) | 2, 3 | `workflow_dispatch` + `workflow_call`. Called by `deploy.yml` before ship. |
| `regression.yml` | 5 (Playwright) | `workflow_dispatch` only. Auto-creates issue + assigns `@Copilot` on failure. |
| `regression-mobile.yml` (not yet wired) | 5 (Maestro) | Deferred per spec 35 §10 until we're past Internal Testing. |
| `deploy.yml`, `deploy-mobile.yml`, `migrate.yml` | (not test; consumers of tests) | `workflow_dispatch`. Guards on `confirm` string. |

**Rule zero preserved**: spec 17 — every workflow is `workflow_dispatch` or `workflow_call`, never `push` / `pull_request` / `schedule`. Free-tier posture.

## 7. How new work lands

**Adding a new Zod schema to the API**:
1. Edit `apps/api/src/modules/<x>/<x>.validation.ts`.
2. `task dev:openapi:regen` — commits both the Zod change and the updated `docs/openapi.yaml`.
3. In each affected client: `cd apps/<c> && npm run codegen` to refresh `src/api-types.ts`.
4. If clients referenced the old shape, `tsc` fails → fix the client code.
5. Add or update a Layer 4 MSW test to assert the client handler's new behaviour.
6. If the change crosses into the DB, add or update a Layer 3 integration test.
7. Commit everything in one PR — the diff shows contract drift in one reviewable place.

**Adding a new user-visible feature**:
1. Spec it (see `docs/specs/`).
2. If API-side: Layers 2 + 3 cover it.
3. If UI-side: Layer 4 covers the component-level behaviour.
4. Once end-to-end: **one** Layer 5 regression flow per user journey. Not per function.

## 8. Invariants

- **Each layer stays narrow.** A unit test that mocks `fetch` is actually a Layer 4 test living in the wrong folder. Move it.
- **Regression flows are read-mostly.** A flow that *creates* data must *tag* it (`testRunId`) and clean up in `afterAll` — spec 25 §cleanup.
- **No Layer 5 test ships without a Layer 4 companion** when the bug class is client-side logic. Layer 5 alone is expensive debug.
- **OpenAPI types are never hand-written downstream.** If a client needs a type for a shape that's not in the spec, add it to the hand-registered list in `apps/api/src/scripts/generate-openapi.ts`. No `src/types/api.ts` parallel to `src/api-types.ts` in any client.
- **Seed data is versioned.** A Layer 3 or Layer 5 test that depends on a specific seed row must reference the seed file by name in a comment — migrations have to preserve what tests depend on.

## 9. Follow-ups

- **Layer 1 CI guard** — job that runs `task dev:openapi:regen` and fails if `git diff docs/openapi.yaml` is non-empty. Forces regen on every API PR.
- **Layer 4 coverage metric** — per-client count of endpoints that have an MSW test. Visible on the CI summary.
- **Spec 08 retirement** — it overlapped all five of today's specs. Once specs 25/35/36/37/42 are reviewed, archive 08.
- **Contract-test per endpoint** — for endpoints not yet hand-registered in the OpenAPI (most non-auth), the client `api-types.ts` falls back to loose types. Incrementally tighten by adding response Zod schemas alongside request ones in `*.validation.ts`.
- **Shared MSW handler pack** — each client ends up writing `{ id: "...", slug: "ramesh-kumar", ... }` mock data for Profile / Review. Extract a shared `@reviewapp/test-fixtures` once the mobile + web + ui versions converge.

## 10. Rationale

Five layers sounds like a lot. It's the minimum to cover the real failure modes of a deployed stack: pure logic (L2), persistence (L3), client-API contract (L1+L4), and real-world composition (L5). Eliminating any one layer forces another to catch what it shouldn't. Spec 37 made L1 real; specs 38-41 make L4 real. Once both land, L5's burden drops — which is what unlocks faster ship cadence without losing confidence.
