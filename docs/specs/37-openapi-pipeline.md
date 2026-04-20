# Spec 37 — OpenAPI Contract Pipeline (umbrella)

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-20
**Status:** Pipeline implemented (generator shipped); consumer specs 38–41 dispatch the adoption across the four client apps.
**Huddle decision:** d34 (2026-04-20) — API source of truth = Zod-schema-derived OpenAPI; all clients consume auto-generated types; contract drift surfaces at build time, not device runtime.

---

## 1. Problem

Four client apps (`apps/web`, `apps/ui`, `apps/mobile`, `apps/regression`) each hand-wrote TypeScript interfaces mirroring API responses. They drifted independently. On 2026-04-20, this produced a runtime-only bug: `apps/mobile/lib/api.ts` typed `ExchangeTokenResponse.token` while the API returned `{ accessToken }`. The field destructured to `undefined`, `setToken(undefined)` broke `expo-secure-store`, and login failed on-device with a cryptic *"Values must be strings"* error. The mismatch slipped past TypeScript because the interface was local fiction.

We need a **single source of truth for the API contract** that every client must conform to, enforced at TypeScript compile time.

## 2. Goals

- OpenAPI 3.1 spec generated from the **actual Zod schemas + route table** of `apps/api`. No hand-authored spec files that drift against the implementation.
- Every client consumes auto-generated TypeScript types; no more hand-written request/response interfaces for endpoints that exist in the spec.
- **Compile-time drift detection**: any client that expects a field not in the OpenAPI spec fails `tsc`.
- **Runtime mock-based tests** (MSW) that use the same generated types — a test that mocks the wrong shape fails at compile time too.
- Zero additional manual work after the one-time migration — the pipeline regenerates via a single task.

## 3. Non-goals

- Runtime response-shape validation in clients (too slow in hot paths; type-check + tests are sufficient).
- Public API docs site (Redoc / Swagger UI) — defer until we have external consumers.
- SDK publishing (`@reviewapp/api-client` on npm) — defer.
- Backward-compatibility version gates / API versioning beyond `/api/v1` — revisit when we have paying customers.
- Switching off Express / Zod / Node to a generate-first framework (tRPC, oRPC). Not worth the rewrite for three clients.

## 4. Pipeline (shipped 2026-04-20)

### 4.1 Generator

`apps/api/src/scripts/generate-openapi.ts` — uses `@asteasolutions/zod-to-openapi@^7.3.4` + `yaml@^2.8.3` + `glob`. Walks every `apps/api/src/modules/*/*.validation.ts` (Zod request schemas) + `*.routes.ts` (method + path + middleware + validation bindings), hand-registers the 8 load-bearing response shapes (AuthUser, ExchangeTokenResponse, Capability, SubscriptionMe, Profile, Review, ReviewsPage, ScanResponse, Error), and emits OpenAPI 3.1.

**Runs via**: `task dev:openapi:regen` — one command, ~2s.

**Writes**: `docs/openapi.yaml` at the repo root, committed.

**Regenerate whenever**: you add a route, change a Zod schema, or change a hand-registered response shape in `generate-openapi.ts`.

### 4.2 What's in the OpenAPI today

- **60 paths** across 11 modules (`auth`, `profile`, `review`, `quality`, `verification`, `media`, `organization`, `recruiter`, `employer`, `reference`, `subscription`).
- **54 schemas** — request bodies (auto from Zod) + the 8 hand-registered responses + re-used composition (QualityBreakdown, Pagination).
- **Security scheme**: `bearerAuth` (JWT in `Authorization` header).
- **`x-middleware`** extension on each path lists auth / rate-limit / role / capability requirements — machine-readable for clients that want to introspect.

### 4.3 Regeneration contract

- `docs/openapi.yaml` is committed. PR reviewers diff it to see contract impact.
- Before any API PR merges, the author is expected to regenerate + commit.
- Future: CI job fails if `git diff docs/openapi.yaml` is non-empty after running the generator (i.e., spec out of sync with code).

## 5. Consumer contract (client apps)

Each of `apps/web`, `apps/ui`, `apps/mobile`, `apps/regression` commits to:

1. **Codegen step**: `npx openapi-typescript ../../docs/openapi.yaml -o src/api-types.ts`
   - Committed as part of `npm run codegen` (or `task dev:types:regen` per client).
   - Generated file `src/api-types.ts` is committed so diffing a PR shows shape impact.
2. **Type substitution (minimum-viable migration)**:
   - Replace at minimum the auth-response interface (the bug class we just hit):
     ```ts
     import type { components } from './api-types';
     type ExchangeTokenResponse = components['schemas']['ExchangeTokenResponse'];
     ```
   - Additional interfaces migrated incrementally in follow-up PRs.
3. **Unit tests with MSW**:
   - One Jest + MSW test per client that intercepts a real API call (`/auth/login` is the canonical one) and asserts the client's consumer code works against a mock satisfying the OpenAPI-generated type.
   - Mock data must be typed against the generated `ExchangeTokenResponse` — a wrong-shape mock fails TypeScript, not just the test.

## 6. Consumer specs (dispatched separately)

| Spec | Client | Surface | Dispatched to |
|---|---|---|---|
| **38** | `apps/mobile` | Auth + profile + reviews | @copilot-swe-agent |
| **39** | `apps/web` | Scan + submit + OTP | @copilot-swe-agent |
| **40** | `apps/ui` | Auth + profile + employer + recruiter + billing | @copilot-swe-agent |
| **41** | `apps/regression` | Already has types via `@playwright/test`; swap hand-written types to generated ones, no MSW | @copilot-swe-agent |

Each consumer spec is scoped to **minimum viable**:
- Codegen wiring
- Type substitution for the auth-response type only
- One Jest + MSW smoke test (not for regression — no MSW there)

Incremental migration of other interfaces happens after the pipeline proves itself.

## 7. Operational flow (post-migration)

When someone changes a Zod schema in `apps/api`:

1. Author runs `task dev:openapi:regen` → `docs/openapi.yaml` updates.
2. Author runs `npm run codegen` in each affected client → `src/api-types.ts` refreshes.
3. If the client referenced a field that was renamed/removed → `tsc` fails. Fix or roll back.
4. If a Jest+MSW mock referenced the old shape → `tsc` also fails in the test file. Fix.
5. Commit all the regenerated files together with the Zod change. One PR, one diff, every client's type drift visible.

This is exactly the property we lost when each client hand-wrote interfaces. Now it's automatic.

## 8. Invariants

- **`docs/openapi.yaml` is committed, never gitignored.** Reviewers see contract changes in diff.
- **Generated files (`apps/*/src/api-types.ts`) are also committed.** Same reason — a wrong-shape type never lands without being visible in the PR diff.
- **Clients never author types for endpoints that exist in the spec.** If they do, the type-gen step produces two-source-of-truth chaos and the whole investment is wasted. Code review rejects hand-written interfaces that duplicate what `src/api-types.ts` already exports.
- **The generator lives in `apps/api/src/scripts/`, not in `infra/scripts/`.** Rationale: it needs to `import` the actual Zod objects; the apps/api tsconfig + path aliases + dependencies are its natural home.
- **When the generator can't infer a response shape** (most non-auth, non-profile endpoints), it falls back to `{ description: "OK" }` — no `$ref`. Clients must not rely on those types being tight. For endpoints that matter to a client, hand-register the response shape in `generate-openapi.ts`.

## 9. Follow-ups (not in v1)

- **CI drift-check** — job that runs `task dev:openapi:regen` and fails if the git-diff of `docs/openapi.yaml` is non-empty. Ensures every API PR regenerates.
- **Response-shape coverage** — today 8 of 60 endpoints have precise response types (the load-bearing ones). Grow coverage to ≥80% over the next few sprints.
- **Extracting response Zod schemas** into `*.validation.ts` alongside request schemas, so the generator derives them automatically instead of the hand-registered list in §4.1. Cleanup, not a blocker.
- **Redoc / Scalar / Swagger UI** hosted at `review-api.teczeed.com/docs` for human browsing.
- **SDK publishing** — `@reviewapp/api-client` on npm with the generated types + a typed fetch wrapper. When we have paying customers asking for it.

## 10. Rationale

Hand-written API interfaces in each client are a **false economy**: cheap to write, expensive when they drift. Every API change gambles against silent client-side bugs. The investment (one generator + four small consumer migrations) trades one week of churn against unlimited future hours of device-only runtime debugging. Net positive within one sprint.
