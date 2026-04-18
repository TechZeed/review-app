# 22 — File-Based Secret Vault Pattern

## Problem

We already have a string-secret pipeline: `.env.dev` → `sync-vault.ts` → GCP Secret Manager / GitHub Secrets. Runtime code reads `process.env`, with `ConfigResolver` falling back to Secret Manager for API secrets.

**Files** don't fit that pipeline. Today they're handled ad-hoc:

- `firebase-service-account.json` — checked in at API root, gitignored, manually placed by each dev.
- `GCP_SA_KEY_FILE=/tmp/review-deployer-key.json` — path in `.env.dev` points at `/tmp`, which any local process can read.
- `google-service-account.json` — Play Store submit key, location undefined.
- Future: Apple ASC API `.p8` key.

No consistent location, no sync path, no Cloud Run story, no new-developer bootstrap.

## Decision

Introduce a **file vault** at `infra/dev/vault/` (gitignored) as the single local location for every runtime-used or build-used binary/JSON credential. Add two new sections to `.env.dev` (parallel to existing string-secret sections). Sync file *contents* to GCP Secret Manager or GitHub Secrets based on which section the entry lives in. Runtime code reads a filepath from `process.env`; Cloud Run writes the file via `--set-secrets` mount; CI writes via a composite action; local dev writes via a pull task.

## Non-goals

- **No custom encryption.** GCP Secret Manager already encrypts at rest and enforces IAM. Reqsume's AES-256-GCM + S3 pattern makes sense on Hetzner where there is no managed secret manager; on GCP Cloud Run it adds ~400 lines of maintenance for zero security gain. Rejected.
- **No runtime Secret Manager API call for files.** Cloud Run `--set-secrets` mounts the file at container start via platform IAM; the running app never needs `secretmanager.versions.access`. Narrower blast radius if the app is compromised.
- **No reference-only files in the vault.** `google-services.json` and `GoogleService-Info.plist` downloaded from Firebase console to extract OAuth client IDs are *not* runtime-used. Delete after extracting IDs — do not add to vault.

## Design

### `.env.dev` — two new sections

```ini
##### GCP Vault Files #####
# Files whose CONTENTS are synced to GCP Secret Manager.
# Cloud Run mounts each at runtime via --set-secrets file mount.
# LHS = env var name the app reads (always ends in _PATH).
# RHS = path relative to repo root, pointing into infra/dev/vault/.
FIREBASE_SA_PATH=infra/dev/vault/firebase-sa.json

##### GitHub Vault Files #####
# Files whose CONTENTS are synced to GitHub Secrets as base64.
# Consumed by CI workflows only (never by Cloud Run runtime).
GCP_DEPLOYER_SA_PATH=infra/dev/vault/gcp-deployer-sa.json
PLAY_STORE_SA_PATH=infra/dev/vault/play-store-sa.json
ASC_API_KEY_PATH=infra/dev/vault/asc-api-key.p8
```

Section header regex in `sync-vault.ts` extends the existing parser. **The `_PATH` suffix is load-bearing** — it tells the sync script "this value is a filepath, read the file's bytes as the secret content."

### GCP Secret Manager naming

Each `*_PATH` entry derives a secret name by dropping `_PATH` and prefixing `review-`, lowercased and hyphenated:

| `.env.dev` key | GCP secret name | Cloud Run mount path |
|---|---|---|
| `FIREBASE_SA_PATH` | `review-firebase-sa` | `/secrets/firebase-sa.json` |

The mount path preserves the filename extension (read from the local vault path). Cloud Run `--set-secrets` sets the env var value to the mount path at deploy time, so `process.env.FIREBASE_SA_PATH === "/secrets/firebase-sa.json"` inside the container.

### GitHub Secret naming

| `.env.dev` key | GitHub secret name |
|---|---|
| `GCP_DEPLOYER_SA_PATH` | `GCP_DEPLOYER_SA_B64` (base64-encoded content) |
| `PLAY_STORE_SA_PATH` | `PLAY_STORE_SA_B64` |
| `ASC_API_KEY_PATH` | `ASC_API_KEY_B64` |

Workflows hydrate before use (see composite action below).

### Writer responsibilities

Environment owns the write. Resolver only reads.

| Env | File writer | Trigger |
|---|---|---|
| Cloud Run (runtime) | GCP via `--set-secrets` mount | Container start, before entrypoint |
| GitHub Actions (CI) | `.github/actions/hydrate-vault` composite action | First step of any job needing vault |
| Local dev | `task dev:vault:pull` | Once per machine; after rotation |

### Resolver API

`apps/api/src/config/configResolver.ts` gains:

```ts
export function resolveFilePath(envKey: string): string {
  const p = process.env[envKey];
  if (!p) throw new ConfigError(`${envKey} not set — vault file missing. Run 'task dev:vault:pull' or check --set-secrets on Cloud Run deploy.`);
  return p;
}
```

No Secret Manager API fallback. No content fetching. One return type.

### Startup sanity check

During `resolveAllSecrets()` at boot, iterate every env key ending in `_PATH`, run `fs.accessSync(p, fs.constants.R_OK)`. Fail loud and fast — crashes the container during boot rather than 200 lines into the first request.

### Sync direction

`sync-vault.ts` extends to handle `##### GCP Vault Files #####` and `##### GitHub Vault Files #####`:

- **Push (`task dev:sync:vault`)**: for each `*_PATH` entry, read the file bytes, push to the matching store.
- **Pull (`task dev:vault:pull`)**: for each `##### GCP Vault Files #####` entry, fetch the secret from GCP Secret Manager, write to the local path. Refuses to overwrite existing files without `--force`. GitHub vault files cannot be pulled (GH secrets are write-only).

### `deploy.js` changes

When deploying an API service, scan `.env.dev` for the `##### GCP Vault Files #####` section. For each entry:

1. Append `--set-secrets=<mount-path>=<secret-name>:latest` to the `gcloud run deploy` args.
2. Override `--set-env-vars` entry for that key to equal the mount path (not the local path).

### Composite action — `.github/actions/hydrate-vault/action.yml`

```yaml
name: Hydrate vault files
description: Decodes GitHub vault secrets to disk before build/deploy steps.
runs:
  using: composite
  steps:
    - shell: bash
      run: |
        mkdir -p infra/dev/vault
        echo "$GCP_DEPLOYER_SA_B64" | base64 -d > infra/dev/vault/gcp-deployer-sa.json
        echo "$PLAY_STORE_SA_B64"   | base64 -d > infra/dev/vault/play-store-sa.json
        echo "$ASC_API_KEY_B64"     | base64 -d > infra/dev/vault/asc-api-key.p8
        chmod 600 infra/dev/vault/*
```

Every workflow that needs a vault file uses `- uses: ./.github/actions/hydrate-vault` as the first step after checkout. Env vars are injected at the workflow level from `secrets.*`.

### `.gitignore`

```
# Vault files — synced to GCP Secret Manager / GitHub Secrets.
# Never commit contents. Populate locally via `task dev:vault:pull`.
infra/dev/vault/
```

### Optional pre-commit guard

Reject any commit touching `infra/dev/vault/` as belt-and-braces (open question — low priority).

## Migration

1. `mkdir -p infra/dev/vault && chmod 700 infra/dev/vault`.
2. Move `apps/api/firebase-service-account.json` → `infra/dev/vault/firebase-sa.json`; replace `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` with `FIREBASE_SA_PATH=infra/dev/vault/firebase-sa.json` under `##### GCP Vault Files #####`.
3. Move `GCP_SA_KEY_FILE=/tmp/review-deployer-key.json` → `GCP_DEPLOYER_SA_PATH=infra/dev/vault/gcp-deployer-sa.json` under `##### GitHub Vault Files #####`. Copy the key file into place.
4. Delete stray `~/Downloads/google-services*.json`, `~/Downloads/GoogleService-Info.plist` (reference-only, not runtime).
5. `task dev:sync:vault` → pushes file contents to GCP SM + GitHub Secrets.
6. Update `deploy.js` to emit `--set-secrets` for vault entries on next API deploy.

## Implementation order

1. Extend `sync-vault.ts`: parse two new sections, push file contents.
2. Add `dev:vault:pull` task + the pull logic in `sync-vault.ts`.
3. Move existing file-secrets to `infra/dev/vault/` (migration steps above).
4. Add `resolveFilePath` + startup accessSync to `apps/api/src/config/configResolver.ts`.
5. Update `deploy.js` to emit `--set-secrets` flags.
6. Add `.github/actions/hydrate-vault` composite action; wire into `deploy.yml` / `deploy-mobile.yml` / `migrate.yml`.
7. Update `CLAUDE.md` with vault pattern under "Core rules".

## References

- Compared against `/Users/muthuishere/muthu/gitworkspace/reqsume-workspace/reqsume/apps/api/src/storage/` (S3 + AES-256-GCM + download-at-startup). That pattern is correct for Hetzner (no managed SM); here it's ~400 lines to replace a single `--set-secrets` flag. Take the mental model (`GetAsFile` abstraction, startup sanity check, vault folder discipline); skip the crypto + S3 download machinery.
- Huddle decision recorded 2026-04-18 — personas: Shaama (Engineering), Senthil (Security), Suren (Architecture).
