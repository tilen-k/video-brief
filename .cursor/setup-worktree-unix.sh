#!/usr/bin/env bash
# Cursor worktree bootstrap for VideoBrief.
# Runs inside the new worktree. $ROOT_WORKTREE_PATH is the primary checkout.
set -euo pipefail

export PATH="${HOME}/.local/share/pnpm/bin:${HOME}/.local/bin:${PATH}"

root="${ROOT_WORKTREE_PATH:-}"

copy_from_root() {
  local name="$1"
  if [[ -n "$root" && -f "$root/$name" && ! -e "$name" ]]; then
    cp "$root/$name" "$name"
  fi
}

copy_from_root ".env.local"
copy_from_root ".env"

if [[ ! -f .env.local && -f .env.example ]]; then
  cp .env.example .env.local
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not on PATH. Install pnpm (see packageManager in package.json)." >&2
  exit 1
fi

# Own node_modules per worktree — do not symlink from the primary checkout.
pnpm install
