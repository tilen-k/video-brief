#!/usr/bin/env bash
# Report in-repo worktree drift vs primary and merge previews.
# Usage: worktree-status.sh [name]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worktree-lib.sh
source "${SCRIPT_DIR}/worktree-lib.sh"

REPO_ROOT="$(worktree_primary_root)"
cd "$REPO_ROOT"

FILTER_NAME="${1:-}"

PRIMARY_BRANCH="$(worktree_primary_branch)"
if [[ -z "$PRIMARY_BRANCH" ]]; then
  echo "ERROR: primary checkout is detached HEAD; checkout a branch first." >&2
  exit 1
fi

PRIMARY_HEAD="$(git rev-parse "$PRIMARY_BRANCH")"
echo "PRIMARY_BRANCH=${PRIMARY_BRANCH}"
echo "PRIMARY_HEAD=${PRIMARY_HEAD}"
echo "REPO_ROOT=${REPO_ROOT}"

if [[ -n "$FILTER_NAME" ]]; then
  NAMES="$(worktree_safe_name "$FILTER_NAME")"
else
  mapfile -t NAMES < <(worktree_list_names "$REPO_ROOT")
fi

if [[ -z "${NAMES[*]:-}" ]]; then
  echo "WORKTREE_COUNT=0"
  exit 0
fi

COUNT=0
for SAFE_NAME in "${NAMES[@]}"; do
  [[ -n "$SAFE_NAME" ]] || continue
  BRANCH="$(worktree_branch_for_name "$SAFE_NAME")"
  WORKTREE_DIR="$(worktree_dir_for_name "$REPO_ROOT" "$SAFE_NAME")"

  if [[ ! -d "$WORKTREE_DIR" ]]; then
    echo "WORKTREE name=${SAFE_NAME} status=missing path=${WORKTREE_DIR}" >&2
    continue
  fi

  if ! git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    echo "WORKTREE name=${SAFE_NAME} status=missing-branch branch=${BRANCH}" >&2
    continue
  fi

  WT_HEAD="$(git rev-parse "$BRANCH")"
  read -r BEHIND AHEAD < <(git rev-list --left-right --count "${PRIMARY_BRANCH}...${BRANCH}")

  if ! git -C "$WORKTREE_DIR" diff --quiet || ! git -C "$WORKTREE_DIR" diff --cached --quiet; then
    DIRTY=yes
  else
    DIRTY=no
  fi

  SYNC_PREVIEW="$(worktree_merge_preview "$BRANCH" "$PRIMARY_BRANCH")"
  APPLY_PREVIEW="$(worktree_merge_preview "$PRIMARY_BRANCH" "$BRANCH")"

  if [[ "$SYNC_PREVIEW" == "identical" && "$APPLY_PREVIEW" == "identical" ]]; then
    LAND=same-as-primary
  elif [[ "$APPLY_PREVIEW" == "identical" ]]; then
    LAND=already-applied
  elif [[ "$APPLY_PREVIEW" == "clean" ]]; then
    LAND=ready
  else
    LAND=needs-sync-or-conflict-resolution
  fi

  echo "WORKTREE name=${SAFE_NAME} branch=${BRANCH} path=${WORKTREE_DIR} head=${WT_HEAD} behind=${BEHIND} ahead=${AHEAD} dirty=${DIRTY} sync=${SYNC_PREVIEW} apply=${APPLY_PREVIEW} land=${LAND}"
  COUNT=$((COUNT + 1))
done

echo "WORKTREE_COUNT=${COUNT}"
