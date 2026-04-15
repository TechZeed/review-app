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

set -a
source "$ENV_FILE"
set +a

# Run the command
case "$CMD" in
  server)         exec tsx "$SCRIPT_DIR/src/server.ts" ;;
  migrate)        exec tsx "$SCRIPT_DIR/src/db/cli.ts" up ;;
  migrate:down)   exec tsx "$SCRIPT_DIR/src/db/cli.ts" down ;;
  migrate:status) exec tsx "$SCRIPT_DIR/src/db/cli.ts" status ;;
  seed)           exec tsx "$SCRIPT_DIR/src/db/seed-cli.ts" up ;;
  seed:down)      exec tsx "$SCRIPT_DIR/src/db/seed-cli.ts" down ;;
  seed:status)    exec tsx "$SCRIPT_DIR/src/db/seed-cli.ts" status ;;
  psql)           exec psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" ;;
  test)           exec vitest run ;;
  build)          exec tsc --noEmit ;;
  *)              echo "Unknown command: $CMD"; exit 1 ;;
esac
