#!/usr/bin/env bash
# Cursor worktree bootstrap for VideoBrief.
# Must run inside the new worktree. $ROOT_WORKTREE_PATH is the primary checkout.
set -euo pipefail

export PATH="${HOME}/.local/share/pnpm/bin:${HOME}/.local/bin:${PATH}"
# Skip interactive pnpm prompts (supply-chain confirmations, etc.).
export CI=true

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

modules_ready() {
  local base="${1:-.}"
  [[ -d "$base/node_modules/.pnpm" && -d "$base/node_modules/next" && -f "$base/node_modules/.modules.yaml" ]]
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

if modules_ready "."; then
  echo "node_modules already present."
  exit 0
fi

# Drop a partial install left by a hung/interrupted pnpm (common in Cursor sandboxes).
# Rename first so a busy hardlinked file cannot block creating a fresh tree.
if [[ -e node_modules ]]; then
  echo "Removing incomplete node_modules before setup..."
  stale="node_modules.stale.$$"
  mv node_modules "$stale"
  rm -rf "$stale" 2>/dev/null || rm -rf "$stale" &
fi

# Fast path: hardlink-clone primary node_modules.
# Cursor's sandbox cannot write ~/.local/share/pnpm/store and remaps pnpm to an
# in-repo .pnpm-store that is often incomplete — a full `pnpm install` then hangs
# on registry fetches through the sandbox proxy. Cloning avoids the store entirely.
if modules_ready "$root"; then
  echo "Cloning node_modules from primary checkout (hardlinks)..."
  if cp -al "$root/node_modules" node_modules 2>/dev/null; then
    echo "node_modules ready (hardlink clone)."
    exit 0
  fi
  echo "Hardlink clone failed; trying full copy..."
  if cp -a "$root/node_modules" node_modules; then
    echo "node_modules ready (full copy)."
    exit 0
  fi
  rm -rf node_modules
  echo "WARNING: could not clone primary node_modules; falling back to pnpm install." >&2
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not on PATH. Install pnpm (see packageManager in package.json)." >&2
  exit 1
fi

# Resolve a real store. Prefer primary's recorded storeDir, then the default home store.
# Never silently use a sandbox-remapped incomplete project .pnpm-store without --offline.
store_dir=""
if [[ -f "$root/node_modules/.modules.yaml" ]]; then
  store_dir="$(
    sed -n 's/^[[:space:]]*"storeDir":[[:space:]]*"\(.*\)".*/\1/p' "$root/node_modules/.modules.yaml" | head -1
  )"
fi
if [[ -z "$store_dir" || ! -d "$store_dir" ]]; then
  store_dir="${HOME}/.local/share/pnpm/store/v11"
fi

install_cmd=(
  pnpm install
  --frozen-lockfile
  --trust-lockfile
  --offline
  --frozen-store
  --store-dir "$store_dir"
  --config.fetch-retries=0
  --config.fetch-timeout=5000
)

run_install() {
  if command -v timeout >/dev/null 2>&1; then
    timeout --signal=KILL 90s "${install_cmd[@]}"
  else
    "${install_cmd[@]}"
  fi
}

echo "Running offline pnpm install from store: $store_dir"
if ! run_install; then
  echo "ERROR: pnpm install failed or timed out." >&2
  echo "Run 'pnpm install' in the primary checkout (${root}) so node_modules is complete, then re-run setup." >&2
  echo "Do not rely on the in-repo .pnpm-store from a Cursor sandbox — it is often incomplete." >&2
  exit 1
fi
