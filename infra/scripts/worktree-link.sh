#!/bin/bash
# Link gitignored shared files from the primary git worktree into the
# current worktree. Idempotent — safe to re-run.
#
# Primary = the worktree whose `.git` is a directory (the main checkout).
# Additional worktrees created via `git worktree add` start blank for
# anything gitignored — this script bridges .env.*, infra/dev/vault/
# from primary → current so 'task *' works without re-bootstrapping.

set -euo pipefail

CUR="$(git rev-parse --show-toplevel)"

# Find the primary worktree by looking for the one whose .git is a directory.
PRIMARY=""
while IFS= read -r path; do
  if [ -d "$path/.git" ]; then
    PRIMARY="$path"
    break
  fi
done < <(git worktree list --porcelain | awk '$1 == "worktree" { print $2 }')

if [ -z "$PRIMARY" ]; then
  echo "Error: could not locate primary worktree." >&2
  exit 1
fi

if [ "$CUR" = "$PRIMARY" ]; then
  echo "Current worktree IS primary ($CUR) — nothing to link."
  exit 0
fi

echo "Linking from primary: $PRIMARY"
echo "             into:    $CUR"
echo

LINKS=(
  ".env"
  ".env.dev"
  "infra/dev/vault"
)
# Note: .env.test is committed (contains only fakes), so it's in the
# worktree already via git — no symlink needed.

for rel in "${LINKS[@]}"; do
  src="$PRIMARY/$rel"
  dst="$CUR/$rel"

  if [ ! -e "$src" ]; then
    echo "  -  $rel                 (missing in primary, skipping)"
    continue
  fi

  # If $dst is a real file/dir (not a symlink), refuse to clobber.
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "  !  $rel                 (exists as real file in worktree, skipping)"
    continue
  fi

  mkdir -p "$(dirname "$dst")"
  ln -sfn "$src" "$dst"
  echo "  ✓  $rel  →  $src"
done

echo
echo "Done."
