# Shared helpers for in-repo worktree scripts.
# Sourced by worktree-create / apply / delete / sync / status — not meant to be run directly.
# shellcheck shell=bash

# Primary checkout root even when cwd is a linked worktree under .worktrees/.
worktree_primary_root() {
  local common
  common="$(git rev-parse --git-common-dir)"
  if [[ "${common}" != /* ]]; then
    common="$(cd "$(git rev-parse --show-toplevel)/${common}" && pwd)"
  else
    common="$(cd "${common}" && pwd)"
  fi
  dirname "${common}"
}

worktree_safe_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/-$//'
}

worktree_branch_for_name() {
  printf 'wt/%s' "$(worktree_safe_name "$1")"
}

worktree_dir_for_name() {
  printf '%s/.worktrees/%s' "$1" "$(worktree_safe_name "$2")"
}

worktree_primary_branch() {
  git symbolic-ref --short HEAD 2>/dev/null || true
}

worktree_autocommit() {
  local worktree_dir="$1"
  local safe_name="$2"
  local message="${3:-chore: worktree changes from ${safe_name}}"

  if ! git -C "$worktree_dir" diff --quiet || ! git -C "$worktree_dir" diff --cached --quiet; then
    git -C "$worktree_dir" add -A
    git -C "$worktree_dir" commit -m "$message"
    return 0
  fi
  return 1
}

# Merge preview: merge $2 into $1 without touching the working tree.
# Prints: clean | conflict | identical
worktree_merge_preview() {
  local into_ref="$1"
  local from_ref="$2"

  if git merge-base --is-ancestor "$from_ref" "$into_ref" 2>/dev/null; then
    printf 'identical\n'
    return 0
  fi

  if git merge-tree --write-tree "$into_ref" "$from_ref" >/dev/null 2>&1; then
    printf 'clean\n'
  else
    printf 'conflict\n'
  fi
}

# List safe names for in-repo worktrees under .worktrees/.
worktree_list_names() {
  local repo_root="$1"
  local worktrees_dir="${repo_root}/.worktrees"
  local entry safe_name branch

  if [[ ! -d "$worktrees_dir" ]]; then
    return 0
  fi

  for entry in "${worktrees_dir}"/*; do
    [[ -d "$entry" ]] || continue
    safe_name="$(basename "$entry")"
    if ! git -C "$entry" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      continue
    fi
    branch="$(git -C "$entry" symbolic-ref --short HEAD 2>/dev/null || true)"
    if [[ "$branch" != "wt/${safe_name}" ]]; then
      continue
    fi
    printf '%s\n' "$safe_name"
  done
}
