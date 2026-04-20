# Spec 36 — Regression CI Workflow

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Done (v1)
**Related:** spec 25 §12 (now fulfilled), spec 17 (workflow policy)

---

## 1. Problem

Spec 25 delivered the regression Playwright suite under `apps/regression/`. It runs locally with `task regression:run`, but there was no team-visible runner: no shared signal, no shared HTML report, no way for a non-dev teammate (QA, PM) to kick a run. Spec 25 §12 explicitly left the CI surface as a follow-up.

We need a GH Actions entry point that runs the existing suite against the deployed dev stack, preserves the free-tier posture (no scheduled/auto triggers), and gives the team a visible failure artifact.

## 2. Shape chosen — A (manual dispatch only)

Evaluated three shapes:

- **A. `workflow_dispatch` only.** Teammate clicks "Run workflow", types `regression`, optionally scopes to one Playwright project. No automatic triggers.
- **B. Post-deploy chain.** `deploy.yml` `workflow_call`s regression after a successful dev deploy. Deferred — couples deploy success to a ~5 min extra run, and we're still stabilising the suite.
- **C. Gate on PR merge.** Block merges on green regression. Deferred — requires a stable suite and is overkill for a pre-GA product.

Chose **A**. Matches spec 17's "`workflow_dispatch` only, free tier" rule. Shape B can be added later as a `workflow_call` reuse of the same `run` job without changing A's UX.

## 3. Deliverables

### 3.1 Workflow — `.github/workflows/regression.yml`

- `workflow_dispatch` with two inputs: `confirm` (must equal `regression`) and optional `project` (Playwright project filter).
- `concurrency: group: regression, cancel-in-progress: false` — never clobber a run that might be mid-mutation against dev DB.
- Two jobs: `validate` (guard on confirmation string) and `run` (bound to GH environment `ci-regression`, 20 min timeout).
- Steps: checkout → setup-node 20 w/ npm cache scoped to `apps/regression/package-lock.json` → setup-bun → `npm ci` + `playwright install --with-deps chromium` → GCP auth via `GCP_SA_KEY` → install cloud-sql-proxy v2.11.0 → run `npx playwright test` (scoped by input if given) → on failure upload `apps/regression/playwright-report` as artifact → on failure file a GH issue.

### 3.2 Bootstrap — `infra/scripts/ci-regression-bootstrap.sh`

Idempotent. Creates the `ci-regression` GH environment via `gh api -X PUT`, sources `.env.regression`, and `gh secret set --env ci-regression` for each of: `REGRESSION_API_URL`, `REGRESSION_SCAN_URL`, `REGRESSION_DASHBOARD_URL`, `CLOUDSQL_CONNECTION_NAME`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DEFAULT_SEED_PASSWORD`.

`GCP_SA_KEY` is intentionally **not** in the per-environment set — it already exists as a repo-wide secret (used by `deploy.yml`).

### 3.3 Spec — this file.

## 4. How to trigger a run

```bash
# one-time bootstrap (run after .env.regression is hydrated locally)
bash infra/scripts/ci-regression-bootstrap.sh

# dispatch
gh workflow run regression.yml -f confirm=regression
# or, scoped to one Playwright project
gh workflow run regression.yml -f confirm=regression -f project=reviewee

# watch
gh run list --workflow=regression.yml --limit 1
gh run watch
```

UI path: Actions → regression → Run workflow → type `regression`.

## 5. Auto-issue on failure

When the `run` job fails, two things happen:

1. **Artifact**: `playwright-report-<run_id>` is uploaded (7-day retention) so anyone on the team can download the HTML report without needing a local checkout.
2. **GH issue**: `gh issue create` with title `regression failed — run <id>`, body linking the run, commit SHA, project filter, and artifact name. Assigned to `@Copilot` with labels `regression,automated-failure`.

**Fallback**: if the `@Copilot` assignee syntax is rejected (not every org/repo has Copilot assignment enabled), the script swallows the error and retries the `gh issue create` without `--assignee`, so an unassigned issue is still filed. The issue is never silently dropped.

Permissions on the `run` job are scoped: `contents: read`, `issues: write`. No broader scopes needed.

## 6. Follow-ups (deferred)

- **Shape B** — post-deploy chain. After `dev:deploy:all` goes green, `deploy.yml` calls regression via `workflow_call`. Blocked on suite stability.
- **Shape C** — PR merge gate. Requires (a) suite green three runs in a row, (b) a faster smoke subset (~2 min) for the PR path.
- **Nightly schedule** — explicitly ruled out by spec 17's free-tier policy.
- **Prod target** — re-scoped when prod goes live, with stricter isolation + no mutation tests.
- **Mobile regression CI** — tracked separately under spec 35 (Maestro), not in scope here.

## 7. Status

Spec 25 §12 ("CI follow-up: expose regression as a GH-dispatched workflow") is now fulfilled by this spec.
