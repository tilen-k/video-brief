# Sync worktree with primary

Merge the primary branch **into** a worktree branch when siblings have landed and the worktree is behind.

```bash
.cursor/worktree-sync.sh <name>
```

- Commits any uncommitted changes in the worktree first.
- Merges the primary checkout’s current branch into `wt/<name>` **inside the worktree**.
- On conflict: resolve in `WORKTREE_PATH`, commit, then run checks there before `/worktree-apply`.
- Abort an in-progress sync merge: `.cursor/worktree-sync.sh <name> --abort`

**When to use**

| Phase | Action |
|-------|--------|
| Parallel work (a, b, c all active) | Do **not** sync — stay isolated |
| Landing (siblings applied, one worktree remains) | Sync first → resolve in worktree → test → apply |

Use `/worktree-status` to see which worktrees are behind and whether sync/apply would conflict.
