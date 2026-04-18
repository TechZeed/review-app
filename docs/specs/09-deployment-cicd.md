# Spec 09: Deployment, CI/CD & Infrastructure

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**Reference:** iepapp deployment patterns (`apps/api/Dockerfile`, `.github/workflows/deploy-api.yml`)
**PRD refs:** PRD 01 (Core Identity), PRD 05 (Monetization), PRD 06 (Trust & Anti-Fraud)

---

## 1. GCP Infrastructure (Singapore -- asia-southeast1)

### 1.1 Service Architecture

```
                                    Internet
                                       |
                                 Cloud Load Balancer
                                       |
                              Cloud Run (API backend)
                              /    |    |    \
                             /     |    |     \
                 Cloud SQL    GCS     Secret    Cloud Run Jobs
                (Postgres)  Bucket   Manager   (video transcode)
                    |
              VPC Connector
           (private IP access)
```

### 1.2 Cloud Run Service (API Backend)

| Property | Staging | Production |
|----------|---------|------------|
| Service name | `review-api-staging` | `review-api-prod` |
| Region | `asia-southeast1` | `asia-southeast1` |
| Memory | 512Mi | 1Gi |
| CPU | 1 | 2 |
| Min instances | 0 | 1 |
| Max instances | 2 | 10 |
| Timeout | 300s | 300s |
| Concurrency | 80 | 80 |
| Ingress | All | All |
| Auth | Allow unauthenticated | Allow unauthenticated |
| Service account | `review-api-staging-sa@<PROJECT>.iam.gserviceaccount.com` | `review-api-prod-sa@<PROJECT>.iam.gserviceaccount.com` |
| VPC connector | `review-vpc-connector` | `review-vpc-connector` |
| Cloud SQL instance | `--add-cloudsql-instances=<CONNECTION_NAME>` | `--add-cloudsql-instances=<CONNECTION_NAME>` |

### 1.3 Cloud SQL (Postgres 15)

| Property | Staging | Production |
|----------|---------|------------|
| Instance name | `review-db-staging` | `review-db-prod` |
| Tier | `db-f1-micro` | `db-custom-2-4096` |
| Storage | 10 GB SSD | 50 GB SSD (auto-increase) |
| High availability | No | Yes (regional) |
| Backups | Daily, 7-day retention | Daily, 30-day retention |
| Point-in-time recovery | No | Yes |
| Private IP | Yes (via VPC) | Yes (via VPC) |
| Public IP | No | No |
| SSL | Required (`verify-ca`) | Required (`verify-ca`) |
| Maintenance window | Any | Sunday 03:00 SGT |
| Database name | `review_app_staging` | `review_app` |

### 1.4 Cloud Storage Bucket

| Property | Value |
|----------|-------|
| Bucket name | `review-app-media-<ENV>` |
| Location | `asia-southeast1` |
| Storage class | Standard |
| Public access | Blocked (signed URLs only) |
| Lifecycle | Delete objects older than 365 days in `/tmp/` prefix |
| CORS | Allow origins: app domains, methods: GET/PUT |

**Bucket structure:**

```
review-app-media-<ENV>/
  qr-codes/          # Generated QR code PNGs
  voice/             # Voice review recordings
  video/             # Video review recordings (raw + transcoded)
  avatars/           # Profile avatar images
  tmp/               # Temporary uploads (auto-deleted after 24h)
```

### 1.5 Secret Manager

All sensitive values stored in GCP Secret Manager, never in environment variables directly.

| Secret Name | Description |
|-------------|-------------|
| `review-jwt-secret` | HS256 signing key for custom JWTs |
| `review-stripe-secret-key` | Stripe API secret key |
| `review-stripe-webhook-secret` | Stripe webhook endpoint secret |
| `review-twilio-account-sid` | Twilio account SID |
| `review-twilio-auth-token` | Twilio auth token |
| `review-twilio-phone-number` | Twilio sender phone number |
| `review-firebase-sa` | Firebase service account JSON (base64-encoded) |
| `review-db-password` | Cloud SQL database password |

**Access pattern:** Cloud Run service account granted `roles/secretmanager.secretAccessor`. Secrets injected as environment variables at deploy time via Cloud Run secret references, or fetched at startup via `@google-cloud/secret-manager` SDK.

### 1.6 Cloud Run Jobs (Video Transcoding)

| Property | Value |
|----------|-------|
| Job name | `review-video-transcode-<ENV>` |
| Image | Same API image (FFmpeg installed in Docker) |
| Memory | 2Gi |
| CPU | 2 |
| Timeout | 600s |
| Trigger | Pub/Sub message from API on video upload |

**Transcoding pipeline:**

1. API receives video upload, stores raw in `video/raw/<id>.webm`
2. API publishes message to `review-video-transcode` Pub/Sub topic
3. Cloud Run Job picks up message, runs FFmpeg: `ffmpeg -i input.webm -vcodec libx264 -acodec aac -movflags +faststart output.mp4`
4. Job uploads transcoded file to `video/transcoded/<id>.mp4`
5. Job updates Media record with transcoded path and duration

### 1.7 VPC Connector

| Property | Value |
|----------|-------|
| Name | `review-vpc-connector` |
| Region | `asia-southeast1` |
| Network | `default` |
| IP range | `10.8.0.0/28` |
| Min instances | 2 |
| Max instances | 3 |
| Machine type | `e2-micro` |

Cloud Run services route traffic through this connector to reach Cloud SQL via private IP.

---

## 2. Docker

### 2.1 Dockerfile (Multi-Stage Build)

Located at `apps/api/Dockerfile`. Three-stage build matching the iepapp pattern.

```dockerfile
# syntax=docker/dockerfile:1.7

############################
# 1) deps stage (cached)
############################
FROM node:23-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm npm ci

############################
# 2) build stage
############################
FROM node:23-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm prune --omit=dev

############################
# 3) runtime stage (small)
############################
FROM node:23-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# FFmpeg for video transcoding (Cloud Run Jobs)
RUN apk add --no-cache ffmpeg

# Security: run as non-root
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

USER app

# Cloud Run uses PORT environment variable (default 8080)
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/server.js"]
```

**Key decisions:**

- Node.js 23 Alpine for smallest image size
- `libc6-compat` for native dependency compatibility (bcrypt, etc.)
- Cache mount on `npm ci` for faster rebuilds
- `npm prune --omit=dev` removes dev dependencies before runtime copy
- Non-root `app` user for security
- FFmpeg installed in runner for video transcoding job reuse
- Port 8080 exposed (Cloud Run default, overridable via `PORT` env var)
- Built-in HEALTHCHECK for Docker-level health monitoring

### 2.2 Health Check Endpoint

Endpoint: `GET /health`

```json
{
  "status": "healthy",
  "timestamp": "2026-04-14T10:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "database": "connected",
    "storage": "accessible"
  }
}
```

Returns HTTP 200 when healthy, HTTP 503 when any dependency is unhealthy. Cloud Run uses this endpoint for startup and liveness probes.

---

## 3. GitHub Actions CI/CD

### 3.1 ci.yml -- Pull Request Checks

Triggered on every PR to `main`.

```yaml
name: ci

on:
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 23
          cache: npm
          cache-dependency-path: apps/api/package-lock.json

      - run: npm ci

      - name: ESLint
        run: npx eslint src/ --max-warnings=0

      - name: Type check
        run: npx tsc --noEmit

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 23
          cache: npm
          cache-dependency-path: apps/api/package-lock.json

      - run: npm ci

      - name: Run unit tests with coverage
        run: npx vitest run --coverage --coverage.reporter=text --coverage.reporter=lcov
        env:
          NODE_ENV: test
          JWT_SECRET: test-jwt-secret-min-16
          FIREBASE_PROJECT_ID: test-project
          GCS_BUCKET_NAME: test-bucket
          GCS_PROJECT_ID: test-project
          STRIPE_SECRET_KEY: sk_test_fake
          STRIPE_WEBHOOK_SECRET: whsec_fake
          SMS_PROVIDER: mock

      - name: Check coverage threshold
        run: |
          COVERAGE=$(npx vitest run --coverage --coverage.reporter=json 2>/dev/null | tail -1)
          echo "Coverage report generated. Minimum threshold: 80%"

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: apps/api/coverage/

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: review_user
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: review_app_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 23
          cache: npm
          cache-dependency-path: apps/api/package-lock.json

      - run: npm ci

      - name: Run migrations
        run: npm run db:migrate
        env:
          NODE_ENV: test
          POSTGRES_HOST: localhost
          POSTGRES_PORT: 5432
          POSTGRES_DB: review_app_test
          POSTGRES_USER: review_user
          POSTGRES_PASSWORD: testpassword
          JWT_SECRET: test-jwt-secret-min-16
          FIREBASE_PROJECT_ID: test-project
          GCS_BUCKET_NAME: test-bucket
          GCS_PROJECT_ID: test-project
          STRIPE_SECRET_KEY: sk_test_fake
          STRIPE_WEBHOOK_SECRET: whsec_fake
          SMS_PROVIDER: mock

      - name: Run integration tests
        run: npx vitest run --config vitest.integration.config.ts
        env:
          NODE_ENV: test
          POSTGRES_HOST: localhost
          POSTGRES_PORT: 5432
          POSTGRES_DB: review_app_test
          POSTGRES_USER: review_user
          POSTGRES_PASSWORD: testpassword
          JWT_SECRET: test-jwt-secret-min-16
          FIREBASE_PROJECT_ID: test-project
          GCS_BUCKET_NAME: test-bucket
          GCS_PROJECT_ID: test-project
          STRIPE_SECRET_KEY: sk_test_fake
          STRIPE_WEBHOOK_SECRET: whsec_fake
          SMS_PROVIDER: mock

  build-check:
    name: Docker Build Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t review-api:ci apps/api
```

### 3.2 deploy-staging.yml -- Deploy to Staging

Triggered on push to `main`.

```yaml
name: deploy-staging

on:
  push:
    branches: [main]

concurrency:
  group: deploy-staging
  cancel-in-progress: false

jobs:
  ci:
    name: CI Checks
    uses: ./.github/workflows/ci.yml

  deploy:
    name: Deploy to Staging
    needs: ci
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 30

    env:
      GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
      GCP_REGION: asia-southeast1
      GCP_ARTIFACT_REPOSITORY: review-apps
      CLOUDSQL_CONNECTION_NAME: ${{ secrets.CLOUDSQL_CONNECTION_NAME }}

    steps:
      - uses: actions/checkout@v4

      - name: Remove .env files
        run: find . -name ".env*" -type f -delete && touch .env

      - name: Google Auth
        id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet

      - name: Ensure Artifact Registry repository exists
        run: |
          gcloud artifacts repositories describe ${{ env.GCP_ARTIFACT_REPOSITORY }} \
            --location=${{ env.GCP_REGION }} || \
          gcloud artifacts repositories create ${{ env.GCP_ARTIFACT_REPOSITORY }} \
            --repository-format=docker --location=${{ env.GCP_REGION }}

      - name: Build and push image
        id: build_image
        run: |
          IMAGE="${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.GCP_ARTIFACT_REPOSITORY }}/api:${{ github.sha }}"
          docker build -t "$IMAGE" apps/api
          docker push "$IMAGE"
          echo "image=$IMAGE" >> "$GITHUB_OUTPUT"

      - name: Run DB migrations
        run: |
          gcloud run jobs execute review-db-migrate-staging \
            --region=${{ env.GCP_REGION }} \
            --wait \
            --args="up"

      - name: Deploy to Cloud Run (staging)
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: review-api-staging
          region: ${{ env.GCP_REGION }}
          image: ${{ steps.build_image.outputs.image }}
          flags: >-
            --allow-unauthenticated
            --service-account=review-api-staging-sa@${{ env.GCP_PROJECT_ID }}.iam.gserviceaccount.com
            --add-cloudsql-instances=${{ env.CLOUDSQL_CONNECTION_NAME }}
            --vpc-connector=review-vpc-connector
            --memory=512Mi
            --cpu=1
            --min-instances=0
            --max-instances=2
            --timeout=300
          env_vars: |
            NODE_ENV=production
            PORT=8080
            GCP_PROJECT_ID=${{ env.GCP_PROJECT_ID }}
            POSTGRES_HOST=/cloudsql/${{ env.CLOUDSQL_CONNECTION_NAME }}
            POSTGRES_PORT=${{ secrets.POSTGRES_PORT }}
            POSTGRES_DB=${{ secrets.POSTGRES_DB }}
            POSTGRES_USER=${{ secrets.POSTGRES_USER }}
            POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
            POSTGRES_SSL_MODE=verify-ca
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            JWT_EXPIRATION_TIME_IN_MINUTES=${{ secrets.JWT_EXPIRATION_TIME_IN_MINUTES }}
            FIREBASE_PROJECT_ID=${{ secrets.FIREBASE_PROJECT_ID }}
            GCS_BUCKET_NAME=${{ secrets.GCS_BUCKET_NAME }}
            GCS_PROJECT_ID=${{ env.GCP_PROJECT_ID }}
            STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
            STRIPE_WEBHOOK_SECRET=${{ secrets.STRIPE_WEBHOOK_SECRET }}
            SMS_PROVIDER=${{ secrets.SMS_PROVIDER }}
            TWILIO_ACCOUNT_SID=${{ secrets.TWILIO_ACCOUNT_SID }}
            TWILIO_AUTH_TOKEN=${{ secrets.TWILIO_AUTH_TOKEN }}
            TWILIO_PHONE_NUMBER=${{ secrets.TWILIO_PHONE_NUMBER }}
            APP_BASE_URL=${{ secrets.APP_BASE_URL }}
            REVIEW_TOKEN_EXPIRY_HOURS=48
            REVIEW_COOLDOWN_DAYS=7

      - name: Smoke test
        run: |
          SERVICE_URL="${{ steps.deploy.outputs.url }}"
          echo "Running smoke tests against $SERVICE_URL"

          # Health check
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")
          if [ "$HTTP_STATUS" != "200" ]; then
            echo "Health check failed with status $HTTP_STATUS"
            exit 1
          fi
          echo "Health check passed"

          # Qualities endpoint (public, seeded data)
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api/v1/qualities")
          if [ "$HTTP_STATUS" != "200" ]; then
            echo "Qualities endpoint failed with status $HTTP_STATUS"
            exit 1
          fi
          echo "Qualities endpoint passed"

          echo "All smoke tests passed"

      - name: Output
        run: |
          echo "Staging deployment successful"
          echo "Service URL: ${{ steps.deploy.outputs.url }}"
```

### 3.3 deploy-prod.yml -- Deploy to Production

Manual trigger or git tag.

```yaml
name: deploy-prod

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: "Type 'deploy-prod' to confirm production deployment"
        required: true
        type: string
  push:
    tags:
      - 'v*'

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  validate:
    name: Validate Trigger
    runs-on: ubuntu-latest
    steps:
      - name: Check confirmation (manual trigger only)
        if: github.event_name == 'workflow_dispatch'
        run: |
          if [ "${{ inputs.confirm }}" != "deploy-prod" ]; then
            echo "Confirmation failed. Input 'deploy-prod' to proceed."
            exit 1
          fi

  ci:
    name: CI Checks
    needs: validate
    uses: ./.github/workflows/ci.yml

  deploy:
    name: Deploy to Production
    needs: ci
    runs-on: ubuntu-latest
    environment: production
    timeout-minutes: 30

    env:
      GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
      GCP_REGION: asia-southeast1
      GCP_ARTIFACT_REPOSITORY: review-apps
      CLOUDSQL_CONNECTION_NAME: ${{ secrets.CLOUDSQL_CONNECTION_NAME }}

    steps:
      - uses: actions/checkout@v4

      - name: Remove .env files
        run: find . -name ".env*" -type f -delete && touch .env

      - name: Google Auth
        id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet

      - name: Build and push image
        id: build_image
        run: |
          IMAGE="${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.GCP_ARTIFACT_REPOSITORY }}/api:${{ github.sha }}"
          docker build -t "$IMAGE" apps/api
          docker push "$IMAGE"
          echo "image=$IMAGE" >> "$GITHUB_OUTPUT"

      - name: Run DB migrations
        run: |
          gcloud run jobs execute review-db-migrate-prod \
            --region=${{ env.GCP_REGION }} \
            --wait \
            --args="up"

      - name: Deploy to Cloud Run (prod) -- no traffic
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: review-api-prod
          region: ${{ env.GCP_REGION }}
          image: ${{ steps.build_image.outputs.image }}
          no_traffic: true
          flags: >-
            --allow-unauthenticated
            --service-account=review-api-prod-sa@${{ env.GCP_PROJECT_ID }}.iam.gserviceaccount.com
            --add-cloudsql-instances=${{ env.CLOUDSQL_CONNECTION_NAME }}
            --vpc-connector=review-vpc-connector
            --memory=1Gi
            --cpu=2
            --min-instances=1
            --max-instances=10
            --timeout=300
          env_vars: |
            NODE_ENV=production
            PORT=8080
            GCP_PROJECT_ID=${{ env.GCP_PROJECT_ID }}
            POSTGRES_HOST=/cloudsql/${{ env.CLOUDSQL_CONNECTION_NAME }}
            POSTGRES_PORT=${{ secrets.POSTGRES_PORT }}
            POSTGRES_DB=${{ secrets.POSTGRES_DB }}
            POSTGRES_USER=${{ secrets.POSTGRES_USER }}
            POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
            POSTGRES_SSL_MODE=verify-ca
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            JWT_EXPIRATION_TIME_IN_MINUTES=${{ secrets.JWT_EXPIRATION_TIME_IN_MINUTES }}
            FIREBASE_PROJECT_ID=${{ secrets.FIREBASE_PROJECT_ID }}
            GCS_BUCKET_NAME=${{ secrets.GCS_BUCKET_NAME }}
            GCS_PROJECT_ID=${{ env.GCP_PROJECT_ID }}
            STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
            STRIPE_WEBHOOK_SECRET=${{ secrets.STRIPE_WEBHOOK_SECRET }}
            SMS_PROVIDER=twilio
            TWILIO_ACCOUNT_SID=${{ secrets.TWILIO_ACCOUNT_SID }}
            TWILIO_AUTH_TOKEN=${{ secrets.TWILIO_AUTH_TOKEN }}
            TWILIO_PHONE_NUMBER=${{ secrets.TWILIO_PHONE_NUMBER }}
            APP_BASE_URL=${{ secrets.APP_BASE_URL }}
            REVIEW_TOKEN_EXPIRY_HOURS=48
            REVIEW_COOLDOWN_DAYS=7

      - name: Health check on new revision
        id: health
        run: |
          REVISION_URL=$(gcloud run revisions list \
            --service=review-api-prod \
            --region=${{ env.GCP_REGION }} \
            --format="value(status.url)" \
            --limit=1)

          echo "Checking health of new revision: $REVISION_URL"

          for i in $(seq 1 5); do
            HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$REVISION_URL/health" 2>/dev/null || echo "000")
            if [ "$HTTP_STATUS" = "200" ]; then
              echo "Health check passed on attempt $i"
              echo "healthy=true" >> "$GITHUB_OUTPUT"
              exit 0
            fi
            echo "Attempt $i: status $HTTP_STATUS, retrying in 10s..."
            sleep 10
          done

          echo "healthy=false" >> "$GITHUB_OUTPUT"
          echo "Health check failed after 5 attempts"

      - name: Route traffic or rollback
        run: |
          if [ "${{ steps.health.outputs.healthy }}" = "true" ]; then
            echo "Routing 100% traffic to new revision"
            gcloud run services update-traffic review-api-prod \
              --region=${{ env.GCP_REGION }} \
              --to-latest
            echo "Production deployment successful"
          else
            echo "Health check failed -- rolling back"
            gcloud run services update-traffic review-api-prod \
              --region=${{ env.GCP_REGION }} \
              --to-latest=false
            echo "Rollback complete. New revision receives no traffic."
            exit 1
          fi

      - name: Output
        if: success()
        run: |
          echo "Production deployment successful"
          echo "Service URL: ${{ steps.deploy.outputs.url }}"
```

---

## 4. Environment Strategy

### 4.1 Environment Files

| File | Purpose | Committed to git |
|------|---------|------------------|
| `.env.example` | Template with all required vars, safe defaults | Yes |
| `.env` or `.env.local` | Local development values | No (`.gitignore`) |
| `.env.test` | Test runner overrides (mock providers, test DB) | No |

Staging and production environments do not use `.env` files. All configuration is injected via Cloud Run environment variables and Secret Manager references at deploy time.

### 4.2 Environment Variable Resolution Order

1. **Local dev:** `.env` file loaded by `tsx --env-file=.env`
2. **CI tests:** Inline `env:` block in GitHub Actions workflow
3. **Staging/Prod:** Cloud Run env vars set during `deploy-cloudrun` action

### 4.3 Per-Environment Differences

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `NODE_ENV` | `development` | `production` | `production` |
| `PORT` | `3000` | `8080` | `8080` |
| `POSTGRES_HOST` | `localhost` | `/cloudsql/<CONN>` | `/cloudsql/<CONN>` |
| `SMS_PROVIDER` | `mock` | `mock` or `twilio` | `twilio` |
| `STRIPE_SECRET_KEY` | `sk_test_xxx` | `sk_test_xxx` | `sk_live_xxx` |
| `GCS_BUCKET_NAME` | `review-app-media-dev` | `review-app-media-staging` | `review-app-media-prod` |
| `APP_BASE_URL` | `http://localhost:5173` | `https://staging.reviewapp.io` | `https://reviewapp.io` |

---

## 5. Database Migration Strategy

### 5.1 Migration Execution

Migrations run as a Cloud Run Job **before** the new revision receives traffic.

```
1. CI passes
2. Docker image built and pushed
3. Cloud Run Job: `review-db-migrate-<ENV>` executes `npm run db:migrate`
4. Job completes successfully
5. New Cloud Run revision deployed (no traffic yet in prod)
6. Health check passes
7. Traffic routed to new revision
```

If migration fails, the deployment halts. The existing revision continues serving traffic.

### 5.2 Migration Cloud Run Job

```bash
# Create the migration job (one-time setup)
gcloud run jobs create review-db-migrate-staging \
  --image=<LATEST_IMAGE> \
  --region=asia-southeast1 \
  --memory=512Mi \
  --cpu=1 \
  --max-retries=0 \
  --task-timeout=300s \
  --set-env-vars="NODE_ENV=production,POSTGRES_HOST=/cloudsql/<CONN>,..." \
  --add-cloudsql-instances=<CONN> \
  --vpc-connector=review-vpc-connector \
  --command="node" \
  --args="dist/db/cli.js,up"
```

### 5.3 Rollback Migrations

Down migrations are available for every migration file. To rollback:

```bash
# Rollback the last migration
npm run db:migrate:down

# Check current status
npm run db:migrate:status
```

**Rules:**

- Every `up` migration must have a corresponding `down` that fully reverses it
- Down migrations must be tested in CI (integration test suite creates and drops tables)
- Never delete a migration file after it has been applied to staging or production

### 5.4 Seed Data

| Environment | Seed behavior |
|-------------|---------------|
| Local dev | Auto-loaded via `docker-compose` entrypoint |
| CI tests | Loaded before integration test suite |
| Staging | Loaded once during initial setup, then manually |
| Production | Never seeded. Qualities and subscription tiers inserted via migration |

Seed files exist for:
- `20260414-0000-seed-qualities.ts` -- the five qualities (Expertise, Care, Delivery, Initiative, Trust)
- `20260414-0001-seed-subscription-tiers.ts` -- free, pro, employer, recruiter, enterprise tiers

In production, these are inserted as part of migrations (not seeds) to ensure they are always present.

---

## 6. Monitoring & Observability

### 6.1 Cloud Run Metrics (Built-in)

| Metric | Alert Threshold |
|--------|----------------|
| Request count | Informational (dashboard only) |
| Request latency (p50, p95, p99) | p99 > 2s for 5 minutes |
| Error rate (4xx, 5xx) | 5xx rate > 5% for 5 minutes |
| Container instance count | > 8 instances for 10 minutes |
| Container startup latency | > 10s for 3 consecutive starts |
| Memory utilization | > 80% for 5 minutes |
| CPU utilization | > 80% for 5 minutes |

### 6.2 Cloud SQL Metrics

| Metric | Alert Threshold |
|--------|----------------|
| Active connections | > 80% of max for 5 minutes |
| Query latency (p95) | > 500ms for 5 minutes |
| Disk utilization | > 80% |
| Replication lag (prod) | > 10s |

### 6.3 Structured Logging (Winston to Cloud Logging)

Winston logger configured in `src/config/logger.ts` outputs structured JSON in production, which Cloud Logging ingests automatically from Cloud Run stdout.

```typescript
// Production log format
{
  "severity": "INFO",
  "message": "Review submitted",
  "httpRequest": { "method": "POST", "url": "/api/v1/reviews" },
  "labels": {
    "module": "review",
    "profileId": "uuid-xxx",
    "reviewId": "uuid-yyy"
  },
  "timestamp": "2026-04-14T10:00:00.000Z"
}
```

**Log levels mapped to Cloud Logging severity:**

| Winston Level | Cloud Logging Severity |
|---------------|----------------------|
| `error` | ERROR |
| `warn` | WARNING |
| `info` | INFO |
| `debug` | DEBUG |

### 6.4 Error Alerting (Cloud Monitoring)

Alert policies created via Terraform/gcloud:

| Alert | Condition | Notification |
|-------|-----------|--------------|
| High error rate | 5xx rate > 5% over 5 min | Email + Slack |
| Database connection failure | Cloud SQL connection errors > 0 for 2 min | Email + Slack |
| Service down | Uptime check fails for 2 consecutive checks | Email + Slack + PagerDuty |
| High latency | p99 latency > 3s for 10 min | Email |

### 6.5 Uptime Checks

| Check | Target | Interval | Timeout |
|-------|--------|----------|---------|
| Health endpoint | `GET /health` | 60s | 10s |
| API availability | `GET /api/v1/qualities` | 300s | 10s |

Uptime checks created in Cloud Monitoring targeting the Cloud Run service URL.

### 6.6 Fraud Spike Alerts

Custom metric exported from the review service:

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| `review/submission_rate` | Reviews per minute per profile | > 10 reviews/min for any single profile |
| `review/device_cluster` | Unique reviews from same device fingerprint | > 5 reviews from same device in 1 hour |
| `review/velocity_anomaly` | Deviation from profile's historical review rate | > 3 standard deviations above mean |

These custom metrics are pushed to Cloud Monitoring via the `@google-cloud/monitoring` SDK, with alert policies that trigger on anomalous patterns.

---

## 7. Rollback Strategy

### 7.1 Cloud Run Revision Rollback (Instant)

Cloud Run maintains a history of deployed revisions. Rollback is instant with zero downtime.

```bash
# List recent revisions
gcloud run revisions list --service=review-api-prod --region=asia-southeast1

# Route traffic to a previous revision
gcloud run services update-traffic review-api-prod \
  --region=asia-southeast1 \
  --to-revisions=review-api-prod-xxxxx=100

# Or via the production deploy workflow: if health check fails,
# traffic stays on the previous revision automatically (see deploy-prod.yml)
```

### 7.2 Database Rollback

If a migration introduces a breaking change:

1. Roll back the Cloud Run revision to the previous image (instant)
2. Run the down migration via Cloud Run Job:
   ```bash
   gcloud run jobs execute review-db-migrate-prod \
     --region=asia-southeast1 \
     --wait \
     --args="down"
   ```
3. Verify database state with `npm run db:migrate:status`

**Constraint:** Down migrations must be backward-compatible. The previous API revision must be able to operate against the rolled-back schema.

### 7.3 Feature Flags (Optional)

For risky features, use a simple feature flag table or environment variable approach:

```typescript
// src/config/features.ts
export const FEATURES = {
  VIDEO_REVIEWS: process.env.FEATURE_VIDEO_REVIEWS === 'true',
  EMPLOYER_DASHBOARD: process.env.FEATURE_EMPLOYER_DASHBOARD === 'true',
  AI_FRAUD_DETECTION: process.env.FEATURE_AI_FRAUD_DETECTION === 'true',
} as const;
```

Feature flags are set as Cloud Run environment variables, changeable without redeployment via:

```bash
gcloud run services update review-api-prod \
  --region=asia-southeast1 \
  --set-env-vars="FEATURE_VIDEO_REVIEWS=false"
```

---

## 8. Local Development

### 8.1 docker-compose.yaml

Located at `infra/local/docker-compose.yaml` (Postgres 16 on port 10032). Driven by `task local:infra:up` / `task local:bootstrap` / `task local:dev`. Reads `.env` at repo root for user/db/port. See spec 23 and CLAUDE.md "Local work uses local Docker Postgres".

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    container_name: review-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: review_user
      POSTGRES_PASSWORD: yourpassword
      POSTGRES_DB: review_app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U review_user -d review_app"]
      interval: 5s
      timeout: 3s
      retries: 10

  firebase-emulator:
    image: andreysenov/firebase-tools:latest
    container_name: review-firebase
    ports:
      - "9099:9099"   # Auth emulator
      - "4000:4000"   # Emulator UI
    command: >
      firebase emulators:start
        --only auth
        --project review-app-local
    volumes:
      - ./firebase.json:/home/node/firebase.json:ro

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: deps
    container_name: review-api
    restart: unless-stopped
    working_dir: /app
    command: npx tsx watch --env-file=.env src/server.ts
    environment:
      NODE_ENV: development
      PORT: 3000
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: review_app
      POSTGRES_USER: review_user
      POSTGRES_PASSWORD: yourpassword
      JWT_SECRET: local-dev-jwt-secret-min-16-chars
      JWT_EXPIRATION_TIME_IN_MINUTES: 60
      FIREBASE_PROJECT_ID: review-app-local
      FIREBASE_AUTH_EMULATOR_HOST: firebase-emulator:9099
      GCS_BUCKET_NAME: review-app-media-dev
      GCS_PROJECT_ID: review-app-local
      STRIPE_SECRET_KEY: sk_test_fake_local_key
      STRIPE_WEBHOOK_SECRET: whsec_fake_local_key
      SMS_PROVIDER: mock
      APP_BASE_URL: http://localhost:5173
      REVIEW_TOKEN_EXPIRY_HOURS: 48
      REVIEW_COOLDOWN_DAYS: 7
      ENABLE_HTTP_LOGGING: "true"
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src:ro
      - ./package.json:/app/package.json:ro
      - ./tsconfig.json:/app/tsconfig.json:ro
    depends_on:
      postgres:
        condition: service_healthy

  migrate:
    build:
      context: .
      dockerfile: Dockerfile
      target: deps
    container_name: review-migrate
    working_dir: /app
    command: >
      sh -c "npx tsx --env-file=.env src/db/cli.ts up &&
             npx tsx --env-file=.env src/db/seed-cli.ts up"
    environment:
      NODE_ENV: development
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: review_app
      POSTGRES_USER: review_user
      POSTGRES_PASSWORD: yourpassword
      JWT_SECRET: local-dev-jwt-secret-min-16-chars
      FIREBASE_PROJECT_ID: review-app-local
      GCS_BUCKET_NAME: review-app-media-dev
      GCS_PROJECT_ID: review-app-local
      STRIPE_SECRET_KEY: sk_test_fake_local_key
      STRIPE_WEBHOOK_SECRET: whsec_fake_local_key
      SMS_PROVIDER: mock
    volumes:
      - ./src:/app/src:ro
      - ./package.json:/app/package.json:ro
      - ./tsconfig.json:/app/tsconfig.json:ro
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

### 8.2 Local Development Workflow

```bash
# Start everything (Postgres + Firebase emulator + API with hot reload)
docker compose up -d

# Run migrations and seed data (first time or after schema changes)
docker compose run --rm migrate

# Watch API logs
docker compose logs -f api

# Run tests locally
npm test

# Stop everything
docker compose down

# Stop and wipe database
docker compose down -v
```

### 8.3 Alternative: Run API Outside Docker

For faster iteration, run only Postgres and Firebase in Docker, and the API natively:

```bash
# Start dependencies only
docker compose up -d postgres firebase-emulator

# Install deps and run migrations
npm ci
npm run db:migrate
npm run db:seed

# Start API with hot reload
npm run dev
```

### 8.4 Firebase Emulator Setup

A minimal `firebase.json` in `apps/api/` for the emulator:

```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

When `FIREBASE_AUTH_EMULATOR_HOST` is set, Firebase Admin SDK automatically routes to the emulator instead of production Firebase. No service account file needed for local development.

---

## 9. GitHub Repository Secrets

### 9.1 Required Secrets per Environment

Secrets are configured in GitHub repository settings under Settings > Environments.

**Staging environment:**

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | Service account JSON key for GCP auth |
| `GCP_PROJECT_ID` | GCP project ID |
| `CLOUDSQL_CONNECTION_NAME` | Cloud SQL connection string |
| `POSTGRES_PORT` | Database port |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRATION_TIME_IN_MINUTES` | Token expiry |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `GCS_BUCKET_NAME` | Cloud Storage bucket |
| `STRIPE_SECRET_KEY` | Stripe test key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `SMS_PROVIDER` | `mock` or `twilio` |
| `TWILIO_ACCOUNT_SID` | Twilio SID (if SMS_PROVIDER=twilio) |
| `TWILIO_AUTH_TOKEN` | Twilio token (if SMS_PROVIDER=twilio) |
| `TWILIO_PHONE_NUMBER` | Twilio sender number |
| `APP_BASE_URL` | Frontend URL for this environment |

**Production environment:** Same secrets as staging, with production values (live Stripe key, real Twilio credentials, etc.).

---

## 10. GCP Setup Checklist (One-Time)

```bash
PROJECT_ID="review-app-prod"
REGION="asia-southeast1"

# 1. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudscheduler.googleapis.com \
  pubsub.googleapis.com \
  --project=$PROJECT_ID

# 2. Create Artifact Registry repository
gcloud artifacts repositories create review-apps \
  --repository-format=docker \
  --location=$REGION

# 3. Create Cloud SQL instance
gcloud sql instances create review-db-prod \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-4096 \
  --region=$REGION \
  --network=default \
  --no-assign-ip \
  --enable-google-private-path \
  --storage-type=SSD \
  --storage-size=50GB \
  --storage-auto-increase \
  --availability-type=REGIONAL \
  --backup-start-time=19:00 \
  --retained-backups-count=30 \
  --enable-point-in-time-recovery \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=19

# 4. Create database and user
gcloud sql databases create review_app --instance=review-db-prod
gcloud sql users create review_user --instance=review-db-prod --password=<SECURE_PASSWORD>

# 5. Create VPC connector
gcloud compute networks vpc-access connectors create review-vpc-connector \
  --region=$REGION \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro

# 6. Create Cloud Storage bucket
gcloud storage buckets create gs://review-app-media-prod \
  --location=$REGION \
  --uniform-bucket-level-access \
  --public-access-prevention

# 7. Create service accounts
gcloud iam service-accounts create review-api-prod-sa \
  --display-name="Review API Production"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:review-api-prod-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:review-api-prod-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:review-api-prod-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:review-api-prod-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"

# 8. Create Pub/Sub topic for video transcoding
gcloud pubsub topics create review-video-transcode

# 9. Create uptime check
gcloud monitoring uptime create review-api-health \
  --resource-type=uptime-url \
  --hostname=<CLOUD_RUN_URL> \
  --path=/health \
  --check-interval=60s \
  --timeout=10s
```

---

## 11. Cost Estimates (Monthly, asia-southeast1)

| Resource | Staging | Production |
|----------|---------|------------|
| Cloud Run (API) | ~$5 (0 min instances) | ~$30-80 (1 min instance) |
| Cloud SQL (Postgres) | ~$8 (db-f1-micro) | ~$50-70 (db-custom-2-4096) |
| Cloud Storage | ~$1 | ~$5-20 |
| VPC Connector | ~$7 | ~$7 |
| Artifact Registry | ~$1 | ~$1 |
| Secret Manager | ~$0 (< 10 secrets) | ~$0 |
| Cloud Monitoring | ~$0 (free tier) | ~$0-5 |
| **Total** | **~$22** | **~$93-183** |

These are estimates for early-stage usage. Costs scale with traffic and storage.
