#!/bin/bash
# Usage: ./run.sh <env> <command>
# Example: ./run.sh dev server
#          ./run.sh local migrate
#          ./run.sh dev seed

set -euo pipefail

ENV="${1:?Usage: ./run.sh <env> <command>}"
CMD="${2:?Usage: ./run.sh <env> <command>}"
shift 2

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load env file from project root
case "$ENV" in
  local) ENV_FILE="$ROOT_DIR/.env" ;;
  dev)   ENV_FILE="$ROOT_DIR/.env.dev" ;;
  *)     ENV_FILE="$ROOT_DIR/.env.$ENV" ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# Committed env-specific defaults (apps/api/config/application.<APP_ENV>.env)
# are loaded by the Node process via loadAppEnvDefaults(). We just export
# APP_ENV so the selector picks the right file.
export APP_ENV="$ENV"

set -a
source "$ENV_FILE"
set +a

# Use npx for local deps
TSX="npx tsx"
VITEST="npx vitest"
TSC="npx tsc"

# Run the command
case "$CMD" in
  server)         exec $TSX "$SCRIPT_DIR/src/server.ts" ;;
  migrate)        exec $TSX "$SCRIPT_DIR/src/db/cli.ts" up ;;
  migrate:down)   exec $TSX "$SCRIPT_DIR/src/db/cli.ts" down ;;
  migrate:status) exec $TSX "$SCRIPT_DIR/src/db/cli.ts" status ;;
  seed)           exec $TSX "$SCRIPT_DIR/src/db/seed-cli.ts" up ;;
  seed:down)      exec $TSX "$SCRIPT_DIR/src/db/seed-cli.ts" down ;;
  seed:status)    exec $TSX "$SCRIPT_DIR/src/db/seed-cli.ts" status ;;
  psql)           PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" ;;
  test)           exec $VITEST run ;;
  build)          exec $TSC --noEmit ;;
  *)              echo "Unknown command: $CMD"; exit 1 ;;
esac
