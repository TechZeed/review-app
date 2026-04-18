# Spec 18: Dev Logs — Live Log Streaming

**Project:** ReviewApp
**Date:** 2026-04-17
**Status:** Done

---

## Why This Exists

Cloud Run logs are not visible by default during local development. The only way to see what's happening on the deployed dev server is to run a `gcloud` command manually every time — which is a one-shot snapshot, not live.

During active development and debugging against the dev environment (Cloud SQL, real Firebase, real GCS), you need:
- **Live log tail** — see new log lines as requests hit the dev server, not a stale 50-line dump
- **Persistent log file** — keep a record of a session's logs so you can grep, diff, or share without re-running
- **Both at once (tee)** — watch live in terminal while also writing to file

The existing `task dev:logs:api` (and `:web`, `:ui`) use `gcloud run services logs read --limit=50` — a one-shot read, not streaming. You'd have to keep re-running it manually.

---

## What Was Built

### `infra/scripts/devlogs.ts`

A Bun script that streams live logs from any Cloud Run dev service to both the terminal and a local `devlogs.log` file.

| Aspect | Detail |
|---|---|
| Runtime | Bun (TypeScript, no compile step) |
| Location | `infra/scripts/devlogs.ts` |
| GCP command | `gcloud run services logs tail` (live stream, not one-shot read) |
| Output | Terminal (stdout) **and** `devlogs.log` (appended) |
| Config source | `GCP_PROJECT_ID` + `GCP_REGION` from `.env.dev` |
| Default service | `review-api-dev` |
| Custom service | Pass as first argument |

### `task dev:logs`

Live streaming task added to `Taskfile.dev.yml` (repo root).

```
task dev:logs                        # tail review-api-dev
task dev:logs -- review-web-dev      # tail a different service
```

The existing one-shot tasks are still available:
```
task dev:logs:api    # snapshot last 50 lines, review-api-dev
task dev:logs:web    # snapshot last 50 lines, review-web-dev
task dev:logs:ui     # snapshot last 50 lines, review-ui-dev
```

---

## Config — No Hardcoding

All GCP config is read from `.env.dev` — never hardcoded in the script or Taskfile.

| Env var | Value | Source |
|---|---|---|
| `GCP_PROJECT_ID` | `humini-review` | `.env.dev` |
| `GCP_REGION` | `asia-southeast1` | `.env.dev` |

`Taskfile.yml` (repo root) loads `.env.dev` at the include site — `dotenv: ['.env.dev']` under the `dev:` include — so all tasks under `dev:*` pick up region and project from the same source. Dotenv never lives inside the included file (spec 23 / feedback memory: Taskfile include-site dotenv).

The script exits with a clear error if either var is missing:
```
Missing GCP_PROJECT_ID or GCP_REGION — load .env.dev first
```

---

## Files Changed

| File | Change |
|---|---|
| `infra/scripts/devlogs.ts` | New — Bun log streaming script |
| `Taskfile.dev.yml` (repo root) | Added `REPO_ROOT` var, `logs:` task, `logs:ui` task; replaced hardcoded region/project with env vars. Dotenv scoping happens at the include site in `Taskfile.yml`. |
| `.env.dev` | Added `GCP_REGION=asia-southeast1` |
