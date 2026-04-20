#!/usr/bin/env bash
set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
ENV_NAME=ci-regression
ENV_FILE=".env.regression"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found in repo root. Run task dev:bundle:pull first."
  exit 1
fi

# Create environment if absent (idempotent — PUT succeeds even if it exists)
gh api -X PUT "/repos/${REPO}/environments/${ENV_NAME}" -F wait_timer=0 >/dev/null
echo "✓ environment '${ENV_NAME}' ready under ${REPO}"

# Source env file so variables are available
set -a
. "$ENV_FILE"
set +a

for KEY in REGRESSION_API_URL REGRESSION_SCAN_URL REGRESSION_DASHBOARD_URL \
           CLOUDSQL_CONNECTION_NAME POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD \
           DEFAULT_SEED_PASSWORD; do
  VAL="${!KEY:-}"
  if [ -z "$VAL" ]; then
    echo "⚠ ${KEY} is not set in ${ENV_FILE} — skipping"
    continue
  fi
  gh secret set "$KEY" --env "$ENV_NAME" --body "$VAL"
done

echo "✓ secrets synced to ${ENV_NAME}"
echo "GCP_SA_KEY is already a repo-wide secret — not copied."
