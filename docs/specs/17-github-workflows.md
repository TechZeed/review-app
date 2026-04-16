# Spec 17: GitHub Workflows

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-16

---

## Workflows

| Workflow | File | Trigger | Confirmation |
|---|---|---|---|
| **CI** | `ci.yml` | Push to main + PRs | — |
| **Deploy** | `deploy.yml` | Manual | Type `deploy` |
| **Migrate** | `migrate.yml` | Manual | Type `migrate` |
| **Deploy Mobile** | `deploy-mobile.yml` | Manual | Type `deploy-mobile` |

---

## 1. CI (`ci.yml`)

**Trigger:** Push to main, PRs to main

**Jobs:**
- Lint & typecheck (`tsc --noEmit`)
- Unit tests (vitest + coverage)
- Integration tests (Postgres service container)
- Docker build check

---

## 2. Deploy (`deploy.yml`)

**Trigger:** Manual (`workflow_dispatch`)

**Inputs:**
| Input | Options | Default |
|---|---|---|
| service | api / web / ui / all | api |
| confirm | Type `deploy` | — |

**What it does:**
1. Validates confirmation
2. Authenticates with GCP (service account key)
3. Configures Docker for Artifact Registry
4. Runs `node deploy.js <service> dev`
5. Smoke test (API health + qualities endpoint)

**Deploys to:** Cloud Run dev services → custom domains (teczeed.com)

**Usage:**
```bash
gh workflow run deploy.yml -f service=all -f confirm=deploy --repo TechZeed/review-app
```

---

## 3. Migrate (`migrate.yml`)

**Trigger:** Manual (`workflow_dispatch`)

**Inputs:**
| Input | Options | Default |
|---|---|---|
| action | up / down / status | up |
| confirm | Type `migrate` | — |

**What it does:**
1. Validates confirmation
2. Authenticates with GCP
3. Installs Cloud SQL Proxy
4. Starts proxy → connects to `dev_review_db`
5. Runs `npx tsx src/db/cli.ts <action>`

**Usage:**
```bash
# Run pending migrations
gh workflow run migrate.yml -f action=up -f confirm=migrate --repo TechZeed/review-app

# Rollback last migration
gh workflow run migrate.yml -f action=down -f confirm=migrate --repo TechZeed/review-app

# Check migration status
gh workflow run migrate.yml -f action=status -f confirm=migrate --repo TechZeed/review-app
```

---

## 4. Deploy Mobile (`deploy-mobile.yml`)

**Trigger:** Manual (`workflow_dispatch`)

**Inputs:**
| Input | Options | Default |
|---|---|---|
| profile | preview / production | preview |
| build_mode | local / cloud | local |
| submit | true / false | true |
| confirm | Type `deploy-mobile` | — |

**What it does:**
1. Validates confirmation
2. Sets up JDK 17 (for local builds)
3. Installs EAS CLI
4. Builds Android AAB (local or cloud)
5. Submits to Play Store internal track (if submit=true)

**Build modes:**
- **local** — builds on GitHub runner, no EAS queue, free
- **cloud** — builds on EAS servers, uses free tier quota (30/month)

**Usage:**
```bash
# Local build + submit
gh workflow run deploy-mobile.yml -f profile=production -f build_mode=local -f submit=true -f confirm=deploy-mobile --repo TechZeed/review-app

# Cloud build only (no submit)
gh workflow run deploy-mobile.yml -f profile=preview -f build_mode=cloud -f submit=false -f confirm=deploy-mobile --repo TechZeed/review-app
```

---

## GitHub Secrets

| Secret | Purpose |
|---|---|
| `GCP_PROJECT_ID` | `humini-review` |
| `GCP_SA_KEY` | Service account key (review-deployer) |
| `CLOUDSQL_CONNECTION_NAME` | Cloud SQL connection string |
| `DB_PASSWORD` | Cloud SQL user password |
| `EXPO_TOKEN` | EAS CLI authentication |
| `GOOGLE_PLAY_SA_KEY` | Play Store service account key |

---

## Custom Domains

| Domain | Cloud Run Service |
|---|---|
| `review-api.teczeed.com` | review-api-dev |
| `review-scan.teczeed.com` | review-web-dev |
| `review-dashboard.teczeed.com` | review-ui-dev |
| `review-profile.teczeed.com` | review-ui-dev |

---

## Taskfile Equivalents

| GitHub Workflow | Taskfile Command |
|---|---|
| `deploy -f service=all` | `task dev:deploy:all` |
| `deploy -f service=api` | `task dev:deploy:api` |
| `migrate -f action=up` | `task dev:migrate` |
| `migrate -f action=down` | `task dev:migrate:down` |
| `deploy-mobile (local)` | `task dev:deploy:mobile` |
| `deploy-mobile (cloud)` | `task dev:deploy:mobile:cloud` |
