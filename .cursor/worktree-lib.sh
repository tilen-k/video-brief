# Shared helpers for in-repo worktree scripts.
# Sourced by worktree-create / apply / delete — not meant to be run directly.
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
