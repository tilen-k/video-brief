#!/usr/bin/env bash
# Cursor worktree bootstrap for VideoBrief.
# Must run inside the new worktree. $ROOT_WORKTREE_PATH is the primary checkout.
set -euo pipefail

export PATH="${HOME}/.local/share/pnpm/bin:${HOME}/.local/bin:${PATH}"

root="${ROOT_WORKTREE_PATH:-}"

if [[ ! -f .git ]]; then
  echo "ERROR: setup-worktree-unix.sh must run inside a git worktree (expected .git file)." >&2
  exit 1
fi

if [[ -z "$root" || ! -d "$root" ]]; then
  echo "ERROR: ROOT_WORKTREE_PATH must point at the primary checkout." >&2
  exit 1
fi

copy_from_root() {
  local name="$1"
  if [[ -f "$root/$name" && ! -e "$name" ]]; then
    cp "$root/$name" "$name"
    echo "Copied ${name} from primary checkout."
  fi
}

copy_from_root ".env.local"
copy_from_root ".env"

if [[ ! -f .env.local && -f .env.example ]]; then
  cp .env.example .env.local
  echo "WARNING: no .env.local in primary checkout — created .env.local from .env.example."
fi

if [[ ! -f .env.local ]]; then
  echo "ERROR: .env.local is missing. Add it to the primary checkout or provide .env.example." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not on PATH. Install pnpm (see packageManager in package.json)." >&2
  exit 1
fi

# Own node_modules per worktree — do not symlink from the primary checkout.
pnpm install
