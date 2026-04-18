# Spec 23: Repo Conventions & PR Workflow

**Project:** ReviewApp
**Date:** 2026-04-18

This spec captures the rules that keep the repo coherent across API, web, UI, and mobile. They are the things we've had to re-correct more than once — worth writing down so the next person (or the next Claude session) doesn't re-discover them.

Related specs: **09** (deployment/CI), **17** (workflows), **22** (file vault), **16** (auth).

---

## 1. Config & env

### 1.1 No hardcoding

If a value changes between local / dev / prod, it is an env var. Not a constant, not a comment, not a field in a committed JSON. This rule overrides convenience.

### 1.2 `.env.dev` is the single source of truth for env-varying runtime values

URLs, project IDs, Firebase config, OAuth client IDs, mobile identifiers, Stripe product/price IDs — all live in `.env.dev` (gitignored). Section headers are parsed by `infra/dev/sync-vault.ts`; never rename them:

```
##### GCP Secrets #####
##### GitHub Secrets #####
##### Both #####
##### GCP Vault Files #####
##### GitHub Vault Files #####
##### Local #####
```

### 1.3 Two-layer env pattern (API)

**Non-secret, env-varying defaults** live in `apps/api/config/application.<env>.env` — **committed**. Loaded at API startup by `loadAppEnvDefaults()` with dotenv `override:false`. Cloud Run `--set-env-vars` / `--set-secrets` (or local `.env.*`) **always win**.

Rules:

- Secrets never go in `application.*.env`.
- Keys stay in lockstep across `{local,dev,test,prod}` (values may differ).
- `config/` is copied into the Docker image so Cloud Run sees it.
- When your local `.env` overrides a value, it must differ for a real reason — we had a case where `.env.test` silently overrode `application.test.env`'s tight test windows with prod values. If the value matches the default, **delete it from `.env.*`**.

### 1.4 Committed JSON that varies by env is rendered from a template

Never edit `apps/mobile/app.json` or `apps/mobile/eas.json` directly — they are generated from `*.template.json` by `infra/dev/apply-mobile-config.ts` using `${VAR}` substitution from `.env.dev`. Both outputs are gitignored. Any new env-varying JSON config follows the same pattern.

### 1.5 File vault

Binary / JSON credentials (service accounts, signing keys, API keys) live under `infra/dev/vault/` — gitignored. Paths declared in `.env.dev` under the two `*** Vault Files ***` sections. The `_PATH` suffix is load-bearing — see spec 22.

---

## 2. Task runner

### 2.1 Always via `task`

Never run `eas`, `gcloud`, `npx sequelize`, `firebase`, `expo` directly. The task wraps dotenv scoping, ordering (e.g. `mobile:config` before `deploy:mobile`), and `--local` defaults. If the command you want has no task, **add a task** — don't shell out.

### 2.2 Taskfile include-site dotenv

Dotenv scope lives only at the include site in the parent `Taskfile.yml`. Never add `dotenv:` inside an included file. Task 3 forbids it and it would bleed across environments.

### 2.3 Three-label pattern

`local:`, `dev:`, `test:` (and `prod:` when we add it). Each label owns a port range so stacks can coexist: local `:10032+`, dev `:6199`, test `:10532`.

### 2.4 Dev/prod parallel

Every deploy/build task defined under `dev:` must have a mirror under `prod:` reading `.env.prod` at the include site. Same task names, same shape, different scope. A dev task without its prod counterpart is a bug.

---

## 3. GitHub workflows

See spec 17 for the full list. The rules themselves:

- `workflow_dispatch` + `workflow_call` only. Never `push`, `pull_request`, or `schedule`. Free-tier minutes are the constraint.
- Every user-facing dispatch has a `confirm:` string input.
- All env-varying values come from `secrets.*`. No literals in YAML.
- Post-build artifact + release steps use `if: success() || failure()` so the build is always recoverable even when a downstream submit step fails.

---

## 4. PR workflow

### 4.1 Branch → PR → merge

- Branch from `main`. Short kebab-case names: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `ci/`.
- One logical change per PR. If the title needs "and", split it.
- Rebase onto `main` before opening; keep a linear history. No merge commits unless resolving a genuine merge from a long-lived branch.

### 4.2 Commit style

Matches what we already use in `git log`:

```
<type>(<scope>): <one-line summary in present tense>

<optional body — why, not what — wrapped at ~80 cols>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `test`. Scope is the app or area: `api`, `web`, `ui`, `mobile`, `infra`, `ci`, `docs`. One-line summary < 72 chars; body explains the *why* and any non-obvious decisions. Example:

```
ci(mobile): render templates in workflow + attach build as GH Release

Fixes local-build brittleness (stale app.json, TTY, JDK/JAVA_HOME drift)
by moving Android builds to GitHub Actions.
```

No `Co-authored-by` trailers (global repo rule).

### 4.3 PR description template

Keep it short — three sections, skip any that don't apply:

```markdown
## Summary
- 1–3 bullets. What changed, why now.

## Test plan
- [ ] Concrete steps to verify. "Ran `task local:test`", "Dispatched deploy-mobile with submit=true", etc.

## Follow-ups
- Anything this PR deliberately defers. Link to issue / spec if tracked.
```

### 4.4 Before opening

Run locally — we don't gate on CI:

```bash
task local:build    # tsc --noEmit across the surface (run from anywhere in repo)
task local:test     # vitest
```

For mobile changes, `task dev:mobile:config` to confirm templates still render; no need to rebuild the APK.

### 4.5 Review

- Self-review the diff as if it were someone else's before requesting review.
- Address review comments by pushing follow-up commits; squash only on merge.
- `gh pr merge --squash` is the default merge mode — the feature branch's commit trail becomes the body of the squash commit.

### 4.6 After merge

- Delete the remote branch (`gh pr merge --delete-branch` handles this).
- If the change introduces or changes a task/workflow/env var, update the relevant spec **in the same PR**. Specs lag only when no one checks.

---

## 5. When rules conflict

Ship, don't stall. If a rule blocks real work (e.g. a migration needs a secret we haven't wired through the vault yet), take the shortcut and file the follow-up in the PR description. The rules exist to reduce repeat mistakes, not to gate shipping.
