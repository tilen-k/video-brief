#!/usr/bin/env bash
# Remove an in-repo worktree and its branch.
# Usage: worktree-delete.sh <name>
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: .cursor/worktree-delete.sh <name>" >&2
  git worktree list >&2
  exit 1
fi

SAFE_NAME="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/-$//')"
BRANCH="wt/${SAFE_NAME}"
WORKTREE_DIR="${REPO_ROOT}/.worktrees/${SAFE_NAME}"

if [[ ! -d "$WORKTREE_DIR" ]]; then
  echo "ERROR: worktree not found: $WORKTREE_DIR" >&2
  exit 1
fi

git worktree remove "$WORKTREE_DIR" --force
git branch -D "$BRANCH" 2>/dev/null || true

if [[ -d "${REPO_ROOT}/.worktrees" ]] && [[ -z "$(ls -A "${REPO_ROOT}/.worktrees" 2>/dev/null)" ]]; then
  rmdir "${REPO_ROOT}/.worktrees"
fi

echo "Removed worktree ${SAFE_NAME} (${BRANCH})"
