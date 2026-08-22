#!/usr/bin/env bash
# Create an in-repo git worktree for parallel agent work.
# Usage: worktree-create.sh [name] [start-ref]
#   name       optional; defaults to wt-<random>
#   start-ref  optional; defaults to HEAD
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
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
  echo "ERROR: worktree already exists: $WORKTREE_DIR" >&2
  echo "Reuse it, or run: .cursor/worktree-delete.sh ${SAFE_NAME}" >&2
  exit 1
fi

mkdir -p "${REPO_ROOT}/.worktrees"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git worktree add "$WORKTREE_DIR" "$BRANCH"
else
  git worktree add -b "$BRANCH" "$WORKTREE_DIR" "$START_REF"
fi

export ROOT_WORKTREE_PATH="$REPO_ROOT"
bash "${REPO_ROOT}/.cursor/setup-worktree-unix.sh"

echo "WORKTREE_NAME=${SAFE_NAME}"
echo "WORKTREE_PATH=${WORKTREE_DIR}"
echo "WORKTREE_BRANCH=${BRANCH}"
echo "REPO_ROOT=${REPO_ROOT}"
echo "HEAD_COMMIT=$(git -C "$WORKTREE_DIR" rev-parse HEAD)"
echo "WORKTREE_START_REF=${START_REF}"
