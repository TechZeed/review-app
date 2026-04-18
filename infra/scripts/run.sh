#!/bin/bash
# Usage: run.sh <env> <command>
# Lives at infra/scripts/run.sh; operates on apps/api.
# Example:
#   infra/scripts/run.sh dev server
#   infra/scripts/run.sh local migrate

set -euo pipefail

ENV="${1:?Usage: run.sh <env> <command>}"
CMD="${2:?Usage: run.sh <env> <command>}"
shift 2

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"

case "$ENV" in
  local) ENV_FILE="$ROOT_DIR/.env" ;;
  dev)   ENV_FILE="$ROOT_DIR/.env.dev" ;;
  *)     ENV_FILE="$ROOT_DIR/.env.$ENV" ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# APP_ENV selects apps/api/config/application.<APP_ENV>.env; loadAppEnvDefaults()
# reads it at boot. process.env (from the sourced .env.<env> below) wins.
export APP_ENV="$ENV"

set -a
source "$ENV_FILE"
set +a

# Run from apps/api so tsx / vitest / tsc pick up the right tsconfig + src tree.
cd "$API_DIR"

TSX="npx tsx"
VITEST="npx vitest"
TSC="npx tsc"

case "$CMD" in
  server)         exec $TSX "$API_DIR/src/server.ts" ;;
  migrate)        exec $TSX "$API_DIR/src/db/cli.ts" up ;;
  migrate:down)   exec $TSX "$API_DIR/src/db/cli.ts" down ;;
  migrate:status) exec $TSX "$API_DIR/src/db/cli.ts" status ;;
  seed)           exec $TSX "$API_DIR/src/db/seed-cli.ts" up ;;
  seed:down)      exec $TSX "$API_DIR/src/db/seed-cli.ts" down ;;
  seed:status)    exec $TSX "$API_DIR/src/db/seed-cli.ts" status ;;
  psql)           PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" ;;
  test)           exec $VITEST run ;;
  build)          exec $TSC --noEmit ;;
  *)              echo "Unknown command: $CMD"; exit 1 ;;
esac
