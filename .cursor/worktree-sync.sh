#!/usr/bin/env bash
# Merge the primary branch into a worktree branch (catch up after siblings land).
# Usage: worktree-sync.sh <name> [--abort]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worktree-lib.sh
source "${SCRIPT_DIR}/worktree-lib.sh"

REPO_ROOT="$(worktree_primary_root)"
cd "$REPO_ROOT"

NAME="${1:-}"
ACTION="${2:-}"

if [[ -z "$NAME" || "$NAME" == "--abort" ]]; then
  echo "Usage: .cursor/worktree-sync.sh <name> [--abort]" >&2
  echo "Active worktrees:" >&2
  git worktree list >&2
  exit 1
fi

if [[ "$ACTION" == "--abort" ]]; then
  SAFE_NAME="$(worktree_safe_name "$NAME")"
  WORKTREE_DIR="$(worktree_dir_for_name "$REPO_ROOT" "$SAFE_NAME")"
  if [[ ! -d "$WORKTREE_DIR" ]]; then
    echo "ERROR: worktree not found: $WORKTREE_DIR" >&2
    exit 1
  fi
  git -C "$WORKTREE_DIR" merge --abort
  echo "Aborted merge in ${WORKTREE_DIR}"
  exit 0
fi

if [[ -n "$ACTION" ]]; then
  echo "Usage: .cursor/worktree-sync.sh <name> [--abort]" >&2
  exit 1
fi

SAFE_NAME="$(worktree_safe_name "$NAME")"
BRANCH="$(worktree_branch_for_name "$SAFE_NAME")"
WORKTREE_DIR="$(worktree_dir_for_name "$REPO_ROOT" "$SAFE_NAME")"

if [[ ! -d "$WORKTREE_DIR" ]]; then
  echo "ERROR: worktree not found: $WORKTREE_DIR" >&2
  git worktree list >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "ERROR: branch not found: ${BRANCH}" >&2
  exit 1
fi

PRIMARY_BRANCH="$(worktree_primary_branch)"
if [[ -z "$PRIMARY_BRANCH" ]]; then
  echo "ERROR: primary checkout is detached HEAD; checkout a branch first." >&2
  exit 1
fi

if [[ "$PRIMARY_BRANCH" == "$BRANCH" ]]; then
  echo "ERROR: primary is on ${BRANCH}; checkout the integration branch first." >&2
  exit 1
fi

worktree_autocommit "$WORKTREE_DIR" "$SAFE_NAME" "chore: worktree changes before sync from ${SAFE_NAME}" || true

if git merge-base --is-ancestor "$PRIMARY_BRANCH" "$BRANCH"; then
  echo "Already synced: ${BRANCH} contains ${PRIMARY_BRANCH}"
  echo "WORKTREE_NAME=${SAFE_NAME}"
  echo "WORKTREE_PATH=${WORKTREE_DIR}"
  echo "WORKTREE_BRANCH=${BRANCH}"
  echo "SYNC_STATUS=identical"
  exit 0
fi

SYNC_PREVIEW="$(worktree_merge_preview "$BRANCH" "$PRIMARY_BRANCH")"
if [[ "$SYNC_PREVIEW" == "conflict" ]]; then
  echo "NOTE: sync may conflict; resolve in WORKTREE_PATH then commit." >&2
fi

if ! git -C "$WORKTREE_DIR" merge "$PRIMARY_BRANCH" --no-edit -m "Merge ${PRIMARY_BRANCH} into worktree ${SAFE_NAME}"; then
  echo "ERROR: merge conflict while syncing ${PRIMARY_BRANCH} into ${BRANCH}" >&2
  echo "Resolve conflicts in: ${WORKTREE_DIR}" >&2
  echo "Then commit, or run: .cursor/worktree-sync.sh ${SAFE_NAME} --abort" >&2
  echo "WORKTREE_NAME=${SAFE_NAME}"
  echo "WORKTREE_PATH=${WORKTREE_DIR}"
  echo "WORKTREE_BRANCH=${BRANCH}"
  echo "SYNC_STATUS=conflict"
  exit 1
fi

echo "Synced ${PRIMARY_BRANCH} into ${BRANCH}"
echo "WORKTREE_NAME=${SAFE_NAME}"
echo "WORKTREE_PATH=${WORKTREE_DIR}"
echo "WORKTREE_BRANCH=${BRANCH}"
echo "SYNC_STATUS=clean"
