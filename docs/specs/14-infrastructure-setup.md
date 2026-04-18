# Spec 14: Infrastructure Setup & Deployment

**Project:** review-app
**GCP Project:** humini-review (Project ID: humini-review, Number: 1049089489429)
**Region:** asia-southeast1 (Singapore)
**Date:** 2026-04-14 (amended 2026-04-18)

> **Newer specs supersede parts of this one.** Read alongside:
> - **spec 22** — file vault pattern (SA keys, Play Store key, Firebase creds). Replaces any "copy the JSON to `apps/api/`" instruction here.
> - **spec 23** — repo conventions (Taskfile at root, `infra/scripts/` for `run.sh` + `deploy.js`, two-layer env pattern). If this spec still says `apps/api/Taskfile.yml` or `./run.sh`, treat that as outdated — the current locations are `Taskfile.yml` at root and `infra/scripts/run.sh`.
> - **spec 17** — manual-only (`workflow_dispatch`) GitHub workflows.
> - **CLAUDE.md** — the canonical quick reference for current paths and tasks.

---

## 1. GCP Resources Provisioned

### Cloud SQL (Postgres)

| Attribute | Value |
|---|---|
| Instance name | `review-db-dev` |
| Version | PostgreSQL 16 |
| Edition | Enterprise |
| Tier | db-f1-micro (~$7/month) |
| Region | asia-southeast1-c |
| Public IP | 35.185.181.255 |
| Connection name | `humini-review:asia-southeast1:review-db-dev` |
| Storage | 10GB HDD |
| Authorized networks | 0.0.0.0/0 (dev only) |
| Max connections | 50 |

**Database:** `dev_review_db`
**User:** `review_user`

```bash
# Commands used to provision
gcloud sql instances create review-db-dev \
  --database-version=POSTGRES_16 \
  --edition=enterprise \
  --tier=db-f1-micro \
  --region=asia-southeast1 \
  --storage-type=HDD \
  --storage-size=10 \
  --availability-type=zonal \
  --assign-ip \
  --authorized-networks=0.0.0.0/0 \
  --database-flags=max_connections=50 \
  --root-password="<root-password>"

gcloud sql databases create dev_review_db --instance=review-db-dev
gcloud sql users create review_user --instance=review-db-dev --password="<password>"
```

### Cloud Storage

| Attribute | Value |
|---|---|
| Bucket | `gs://humini-review-media-dev` |
| Location | asia-southeast1 |
| Access | Uniform bucket-level |
| Public access | Prevented |

```bash
gcloud storage buckets create gs://humini-review-media-dev \
  --location=asia-southeast1 \
  --uniform-bucket-level-access \
  --public-access-prevention
```

### Artifact Registry

| Attribute | Value |
|---|---|
| Repository | `review-apps` |
| Format | Docker |
| Location | asia-southeast1 |
| Path | `asia-southeast1-docker.pkg.dev/humini-review/review-apps/` |

```bash
gcloud artifacts repositories create review-apps \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="Review app container images"
```

### Cloud Run Services

| Service | Image Source | Memory | CPU | Port | Min/Max Instances |
|---|---|---|---|---|---|
| `review-api-dev` | `review-apps/api` | 512Mi | 1 | 8080 | 0/2 |
| `review-web-dev` | `review-apps/web` | 256Mi | 1 | 80 | 0/2 |
| `review-ui-dev` | `review-apps/ui` | 256Mi | 1 | 80 | 0/2 |

**Live URLs:**

| Service | URL |
|---|---|
| API | https://review-api-dev-1049089489429.asia-southeast1.run.app |
| Web (QR review) | https://review-web-dev-1049089489429.asia-southeast1.run.app |
| UI (Dashboard) | https://review-ui-dev-1049089489429.asia-southeast1.run.app |

---

## 2. Secret Manager (Vault)

All sensitive configuration stored in GCP Secret Manager. Never in code, never in .env files committed to git.

| Secret Name | Maps to Env Var | Purpose |
|---|---|---|
| `review-jwt-secret` | `JWT_SECRET` | JWT signing key (64-char hex) |
| `review-db-password` | `POSTGRES_PASSWORD` | Cloud SQL user password |
| `review-db-host` | `POSTGRES_HOST` | Cloud SQL IP address |
| `review-db-name` | `POSTGRES_DB` | Database name |
| `review-db-user` | `POSTGRES_USER` | Database user |
| `review-stripe-secret` | `STRIPE_SECRET_KEY` | Stripe API key |
| `review-stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

```bash
# Read a secret
gcloud secrets versions access latest --secret=review-jwt-secret

# Update a secret
echo -n "new-value" | gcloud secrets versions add review-db-password --data-file=-

# List all secrets
gcloud secrets list --project=humini-review
```

---

## 3. ConfigResolver Pattern

The app uses a `ConfigResolver` (`src/config/configResolver.ts`) that resolves configuration from two sources:

```
Priority 1: Environment variables (process.env)
Priority 2: GCP Secret Manager (fallback)
```

### How it works

```
┌─────────────────────────────────────────────────┐
│                  ConfigResolver                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  resolveConfig("JWT_SECRET")                     │
│    ├─ 1. Check process.env.JWT_SECRET            │
│    │     → Found? Return it.                     │
│    │                                             │
│    └─ 2. Look up SECRET_MAP["JWT_SECRET"]        │
│          → "review-jwt-secret"                   │
│          → Fetch from Secret Manager             │
│          → Cache it + set process.env            │
│          → Return it.                            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Per-environment behavior

| Environment | Config Source | Secret Manager Hit? |
|---|---|---|
| **Local dev** | `.env` or `.env.dev` file loaded via `--env-file` | Never — all vars present |
| **Cloud Run (dev)** | `--set-env-vars` + `--set-secrets` inject vars | Never — Cloud Run injects secrets as env vars |
| **Cloud Run (prod)** | Some vars injected, some resolved at runtime | Yes — for any missing vars |

### Startup sequence

```typescript
// server.ts
await resolveAllSecrets();     // 1. Fill missing env vars from vault
const { env } = await import("./config/env.js");  // 2. Zod parse (all vars now present)
initializeFirebase();          // 3. Firebase
await initDb();                // 4. Database
app.listen(port);              // 5. Server
```

---

## 4. Cloud SQL Connection Strategy

The app detects the connection mode automatically:

| Signal | Connection Type | Used When |
|---|---|---|
| `K_SERVICE` env var present | Unix socket via Cloud SQL Proxy | Cloud Run (auto-injected) |
| `CLOUDSQL_CONNECTION_NAME` set | Unix socket via Cloud SQL Proxy | Explicit socket mode |
| `POSTGRES_HOST` starts with `/cloudsql` | Unix socket | Explicit socket path |
| None of above | TCP connection to `POSTGRES_HOST:POSTGRES_PORT` | Local dev, CI |

**Cloud Run uses Unix socket** because:
- Cloud Run sidecar runs Cloud SQL Auth Proxy automatically (via `--add-cloudsql-instances`)
- Socket path: `/cloudsql/humini-review:asia-southeast1:review-db-dev`
- No public IP authorization needed
- No SSL configuration needed

**Local dev uses TCP** because:
- Docker Compose Postgres on `localhost:6132`
- Or direct to Cloud SQL public IP `35.185.181.255` (authorized `0.0.0.0/0` for dev)

---

## 5. IAM & Service Accounts

### CI/CD Service Account

| Attribute | Value |
|---|---|
| Name | `review-deployer` |
| Email | `review-deployer@humini-review.iam.gserviceaccount.com` |

**Roles granted:**

| Role | Purpose |
|---|---|
| `roles/run.admin` | Deploy Cloud Run services |
| `roles/artifactregistry.writer` | Push Docker images |
| `roles/secretmanager.secretAccessor` | Read secrets |
| `roles/cloudsql.client` | Connect to Cloud SQL |
| `roles/storage.admin` | Read/write GCS bucket |
| `roles/iam.serviceAccountUser` | Act as service account |

```bash
# Commands used
gcloud iam service-accounts create review-deployer \
  --display-name="Review App Deployer"

for ROLE in roles/run.admin roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor roles/cloudsql.client \
  roles/storage.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding humini-review \
    --member="serviceAccount:review-deployer@humini-review.iam.gserviceaccount.com" \
    --role="$ROLE" --quiet
done

gcloud iam service-accounts keys create /tmp/review-deployer-key.json \
  --iam-account=review-deployer@humini-review.iam.gserviceaccount.com
```

### Default Compute Service Account

The default compute SA (`1049089489429-compute@developer.gserviceaccount.com`) needed Secret Manager access for Cloud Run to inject secrets:

```bash
gcloud projects add-iam-policy-binding humini-review \
  --member="serviceAccount:1049089489429-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 6. GitHub Secrets

Configured via `gh secret set`:

| Secret | Value | Purpose |
|---|---|---|
| `GCP_PROJECT_ID` | `humini-review` | Project identifier for gcloud commands |
| `GCP_SA_KEY` | JSON key file contents | Service account credentials for CI/CD |
| `CLOUDSQL_CONNECTION_NAME` | `humini-review:asia-southeast1:review-db-dev` | Cloud SQL connection for deployments |

```bash
gh secret set GCP_PROJECT_ID --body "humini-review"
gh secret set CLOUDSQL_CONNECTION_NAME --body "humini-review:asia-southeast1:review-db-dev"
gh secret set GCP_SA_KEY < /tmp/review-deployer-key.json
```

---

## 7. GCP APIs Enabled

```bash
gcloud services enable \
  sqladmin.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com
```

---

## 8. deploy.js Script

Deployment script at project root. Handles build, push, and deploy for all services.

```
Usage: node deploy.js <service> <environment>
  service:     api | web | ui | all
  environment: dev | staging | prod
```

### What it does per service

**API deployment:**
1. `docker build -t review-api:<tag> apps/api/`
2. `docker tag` → `asia-southeast1-docker.pkg.dev/humini-review/review-apps/api:<tag>`
3. `docker push` to Artifact Registry
4. `gcloud run deploy review-api-<env>` with:
   - `--add-cloudsql-instances` for DB proxy
   - `--update-env-vars` for each config (avoids colon parsing issues)
   - `--set-secrets` for vault references
   - `--allow-unauthenticated`

**Web/UI deployment:**
1. `docker build` (multi-stage: node build → nginx serve)
2. `docker tag` + `docker push`
3. `gcloud run deploy review-<web|ui>-<env>` with nginx on port 80

### Lessons learned

- **PORT is reserved**: Cloud Run sets `PORT` automatically. Including it in `--set-env-vars` causes a deploy error.
- **Colons in env vars**: `POSTGRES_HOST=/cloudsql/project:region:instance` contains colons that break `--set-env-vars` comma-separated format. Solution: use `--update-env-vars` per variable, or use `CLOUDSQL_CONNECTION_NAME` and let the app build the path.
- **Secret Manager permissions**: Cloud Run's default compute service account needs `roles/secretmanager.secretAccessor` to inject secrets via `--set-secrets`.

---

## 9. GitHub Actions Workflows

### CI (`ci.yml`) — Runs on push to main + PRs

```
Trigger: push to main, PR to main
Jobs:
  1. lint-and-typecheck (ESLint + tsc --noEmit)
  2. unit-tests (vitest with coverage)
  3. integration-tests (vitest against Postgres service container)
  4. build-check (docker build)
```

### Deploy Staging (`deploy-staging.yml`) — Manual only

```
Trigger: workflow_dispatch (type 'deploy-staging' to confirm)
Inputs: service (api/web/ui/all)
Jobs:
  1. validate (confirm input)
  2. ci (reuse ci.yml)
  3. deploy (node deploy.js <service> staging)
  4. smoke test (health + qualities endpoint)
```

### Deploy Prod (`deploy-prod.yml`) — Manual only

```
Trigger: workflow_dispatch (type 'deploy-prod' to confirm)
Inputs: service (api/web/ui/all)
Jobs:
  1. validate (confirm input)
  2. ci (reuse ci.yml)
  3. deploy (node deploy.js <service> prod)
  4. health check (5 retries with 10s backoff)
```

---

## 10. Local .env Files

| File | Purpose | Committed? |
|---|---|---|
| `.env.example` | Template with placeholder values | Yes |
| `.env` | Local dev with docker-compose Postgres | No (gitignored) |
| `.env.dev` | Dev environment pointing to Cloud SQL | No (gitignored) |
| `.env.staging` | Staging environment | No (gitignored) |
| `.env.production` | Production environment | No (gitignored) |

### .env.dev contents (secrets redacted)

```env
NODE_ENV=development
PORT=3000
POSTGRES_HOST=35.185.181.255
POSTGRES_PORT=5432
POSTGRES_DB=dev_review_db
POSTGRES_USER=review_user
POSTGRES_PASSWORD=<from vault: review-db-password>
CLOUDSQL_CONNECTION_NAME=humini-review:asia-southeast1:review-db-dev
JWT_SECRET=<from vault: review-jwt-secret>
FIREBASE_PROJECT_ID=humini-review
GCP_BUCKET_NAME=humini-review-media-dev
GCP_PROJECT_ID=humini-review
STRIPE_SECRET_KEY=<from vault: review-stripe-secret>
STRIPE_WEBHOOK_SECRET=<from vault: review-stripe-webhook-secret>
SMS_PROVIDER=mock
APP_BASE_URL=http://localhost:3000
```

---

## 11. Seed Data on Cloud SQL

517 reviews seeded across 6 profiles on `dev_review_db`:

| Profile | Reviews | Top Quality | Industry |
|---|---|---|---|
| ramesh-kumar | 150 | Expertise (35%) | Auto Sales |
| sarah-williams | 200 | Care (35%) | Healthcare |
| priya-sharma | 80 | Care (31%) | Hospitality |
| david-chen | 45 | Expertise (32%) | Banking |
| lisa-tan | 30 | Initiative (31%) | F&B |
| ahmed-hassan | 12 | Expertise (20%) | Retail |

```bash
# Run migrations against Cloud SQL
npx tsx --env-file=.env.dev src/db/cli.ts up

# Seed data
npx tsx --env-file=.env.dev src/db/seed-cli.ts up

# Connect directly
PGPASSWORD=<password> psql -h 35.185.181.255 -U review_user -d dev_review_db
```

---

## 12. Docker Configurations

### API Dockerfile (3-stage)

```
Stage 1 (deps):    node:23-alpine → npm ci
Stage 2 (build):   Copy source → tsc → npm prune --omit=dev
Stage 3 (runner):  node:23-alpine → non-root user → CMD ["node", "dist/server.js"]
Port: 8080
```

### Web/UI Dockerfile (2-stage)

```
Stage 1 (build):   node:20-alpine → npm ci → npm run build
Stage 2 (serve):   nginx:alpine → copy dist/ → copy nginx.conf
Port: 80
```

### Local Docker Compose

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["6132:5432"]
    environment:
      POSTGRES_DB: review_app
      POSTGRES_USER: review_user
      POSTGRES_PASSWORD: changeme
```

---

## 13. Estimated Monthly Costs (Dev Environment)

| Resource | Tier | Est. Cost |
|---|---|---|
| Cloud SQL | db-f1-micro | ~$7/month |
| Cloud Run (API) | 0-2 instances, 512Mi | ~$0-5/month (pay-per-use) |
| Cloud Run (Web) | 0-2 instances, 256Mi | ~$0-2/month |
| Cloud Run (UI) | 0-2 instances, 256Mi | ~$0-2/month |
| Cloud Storage | <1GB media | ~$0.02/month |
| Secret Manager | 7 secrets | ~$0.42/month |
| Artifact Registry | <5GB images | ~$0.50/month |
| **Total** | | **~$10-17/month** |
