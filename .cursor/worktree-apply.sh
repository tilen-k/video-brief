#!/usr/bin/env bash
# Merge a worktree branch into the primary checkout.
# Usage: worktree-apply.sh <name>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worktree-lib.sh
source "${SCRIPT_DIR}/worktree-lib.sh"

REPO_ROOT="$(worktree_primary_root)"
cd "$REPO_ROOT"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: .cursor/worktree-apply.sh <name>" >&2
  echo "Active worktrees:" >&2
  git worktree list >&2
  exit 1
fi

SAFE_NAME="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/-$//')"
BRANCH="wt/${SAFE_NAME}"
WORKTREE_DIR="${REPO_ROOT}/.worktrees/${SAFE_NAME}"

if [[ ! -d "$WORKTREE_DIR" ]]; then
  echo "ERROR: worktree not found: $WORKTREE_DIR" >&2
  git worktree list >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "ERROR: branch not found: ${BRANCH}" >&2
  exit 1
fi

if ! git -C "$WORKTREE_DIR" diff --quiet || ! git -C "$WORKTREE_DIR" diff --cached --quiet; then
  git -C "$WORKTREE_DIR" add -A
  git -C "$WORKTREE_DIR" commit -m "chore: worktree changes from ${SAFE_NAME}"
fi

TARGET_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
if [[ -z "$TARGET_BRANCH" ]]; then
  echo "ERROR: primary checkout is detached HEAD; checkout a branch first." >&2
  exit 1
fi

git merge "${BRANCH}" --no-edit -m "Merge worktree ${SAFE_NAME}"

echo "Applied ${BRANCH} into ${TARGET_BRANCH}"
