# Spec 52 — Deploys must auto-run pending migrations

**Owner:** Open — Sreyash / Harsh / Hari (whoever picks it up first) · **Date:** 2026-04-20 · **Status:** Draft
**Severity:** High — every missed migration becomes a runtime 500. Spec 50's `recruiter_blocks` bug is the most recent example; it sat in code for days because no one ran `task dev:migrate` after deploying.
**Related:** Spec 02 (database), CLAUDE.md "always via task" rule.

## Problem

Today, `task dev:deploy:api` runs `node infra/scripts/deploy.js api dev`. That script does **not** run migrations. The Dockerfile's `CMD` is `node dist/server.js` — no migrate at boot. `apps/api/src/server.ts:28-30` even has the hook commented out:

```ts
// Migrations will be run here once the db/migrate module is implemented
// const { migrateUp } = await import("./db/migrate.js");
// await migrateUp();
```

`task dev:migrate` exists, but no deploy task depends on it. So whenever a developer ships a feature with a new migration, they have to remember a separate task. They forget. The dev DB drifts. Features 500.

This has already bitten us at least once (spec 50, `recruiter_blocks` missing on dev). It will keep happening until deploy and migrate are coupled.

## Decision

**Option A (recommended) — Taskfile dependency.** Make `dev:deploy:api` and `prod:deploy:api` depend on `migrate`. Migration runs on the developer's machine through the Cloud SQL Auth Proxy *before* the new Cloud Run revision is rolled out. Safe at our scale (Cloud Run scales 0–2; old revision keeps serving until new one is healthy; migration is additive in 99% of cases).

**Option B (rejected for now) — Boot-time migrate.** Uncomment `server.ts:28-30` so each new container migrates on startup. Cleaner long-term but races under concurrent revisions, and a slow migration stalls every cold start. Re-evaluate when we move past 0–2 instances.

**Option C (rejected) — Cloud Run Job.** A pre-deploy migration job. Heavier infra than we need today.

Pick A. Document the rationale in the PR.

## GIVEN / WHEN / THEN

- **GIVEN** the dev branch has a new migration **WHEN** a developer runs `task dev:deploy:api` **THEN** `task dev:migrate` runs first; on success the deploy proceeds; on migration failure the deploy aborts (no Cloud Run revision created).
- **GIVEN** there are no pending migrations **WHEN** `task dev:deploy:api` runs **THEN** Umzug logs "no pending migrations", deploy proceeds, no errors.
- **GIVEN** `task prod:deploy:api` is run **THEN** the same migrate-then-deploy flow happens against prod Cloud SQL.
- **GIVEN** `task local:deploy:api` is added in the future **THEN** the same pattern applies (dev/prod parallel-label rule from CLAUDE.md).

## Slice checklist

- [ ] `Taskfile.dev.yml` — add `deps: [migrate]` to **both** `deploy:api` *and* `deploy:all`. Mirror in `Taskfile.prod.yml`. The dep does **not** cascade automatically: `deploy:all` runs `node deploy.js all dev`, which loops over services inside the script and bypasses the `deploy:api` task entirely (verified at `infra/scripts/deploy.js:472`). `deploy:web` and `deploy:ui` stay untouched (frontends don't migrate).
- [ ] Verify `task dev:migrate` exits non-zero on failure (it should — Umzug throws on a bad migration). Manually: temporarily commit a broken migration on a throwaway branch, run `task dev:deploy:api`, confirm deploy never hits Cloud Run.
- [ ] Update CLAUDE.md "Commands" → `dev:deploy:api` description: "Cloud Run deploy. Auto-runs `dev:migrate` first."
- [ ] Update `docs/deployment-guide.md` to reflect the new behaviour (migration-then-deploy).
- [ ] Remove the `// Migrations will be run here…` dead comment in `apps/api/src/server.ts:28-30` — or leave a one-liner pointing at this spec ("see spec 52 — migrations run via Taskfile dep, not at boot").

## Invariants

- Migrations run **before** the Cloud Run revision rollout, not after, not during.
- Every `deploy:api` task across every env label (dev, prod, future local) carries the same `deps: [migrate]`.
- No change to the deploy.js script itself — the chaining is at the Taskfile layer where dotenv scoping already lives.
- No change to `local:server` / `local:dev` — local dev already has `local:bootstrap` which migrates explicitly. Don't double-migrate on every `local:dev`.

## Files

- `Taskfile.dev.yml`
- `Taskfile.prod.yml`
- `apps/api/src/server.ts` (delete or annotate dead comment)
- `CLAUDE.md` (one-line update)
- `docs/deployment-guide.md`

## Don't touch

- `infra/scripts/deploy.js` — keep it agnostic; chaining is the Taskfile's job.
- `infra/scripts/run.sh` — same reason.
- Boot-time migration in `server.ts` — explicitly out of scope (Option B is rejected).

## Risk register

- **Long migration blocks deploy.** Acceptable today; flag at code review if a migration looks like it'll take >30s. Future spec to handle: split heavy migrations or move them to a Cloud Run Job.
- **Migration succeeds, deploy fails.** New schema is live, old code is still running, mismatch could surface as 500s on the old revision until the new revision rolls. Mitigation: keep migrations additive (add column nullable, not required). This is already best practice; not new with this spec.
- **Developer's machine lacks Cloud SQL Auth Proxy.** `task dev:migrate` already starts the proxy. If it doesn't on a fresh setup, that's an unrelated bug to fix.
