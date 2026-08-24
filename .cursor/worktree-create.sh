#!/usr/bin/env bash
# Create an in-repo git worktree for parallel agent work.
# Usage: worktree-create.sh [name] [start-ref]
#   name       optional; defaults to wt-<random>
#   start-ref  optional; defaults to HEAD
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worktree-lib.sh
source "${SCRIPT_DIR}/worktree-lib.sh"

REPO_ROOT="$(worktree_primary_root)"
cd "$REPO_ROOT"

NAME="${1:-}"
START_REF="${2:-HEAD}"

if [[ -z "$NAME" ]]; then
  SUFFIX="$(printf '%04x%04x' $((RANDOM % 65536)) $((RANDOM % 65536)))"
  NAME="wt-${SUFFIX}"
fi

SAFE_NAME="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/-$//')"
BRANCH="wt/${SAFE_NAME}"
WORKTREE_DIR="${REPO_ROOT}/.worktrees/${SAFE_NAME}"

if [[ -d "$WORKTREE_DIR" ]]; then
  if git -C "$WORKTREE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Reusing existing worktree: $WORKTREE_DIR"
  else
    echo "ERROR: $WORKTREE_DIR exists but is not a git worktree." >&2
    echo "Remove it, or run: .cursor/worktree-delete.sh ${SAFE_NAME}" >&2
    exit 1
  fi
else
  mkdir -p "${REPO_ROOT}/.worktrees"

  if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    git worktree add "$WORKTREE_DIR" "$BRANCH"
  else
    git worktree add -b "$BRANCH" "$WORKTREE_DIR" "$START_REF"
  fi
fi

export ROOT_WORKTREE_PATH="$REPO_ROOT"
(
  cd "$WORKTREE_DIR"
  bash "${REPO_ROOT}/.cursor/setup-worktree-unix.sh"
)

echo "WORKTREE_NAME=${SAFE_NAME}"
echo "WORKTREE_PATH=${WORKTREE_DIR}"
echo "WORKTREE_BRANCH=${BRANCH}"
echo "REPO_ROOT=${REPO_ROOT}"
echo "HEAD_COMMIT=$(git -C "$WORKTREE_DIR" rev-parse HEAD)"
echo "WORKTREE_START_REF=${START_REF}"
