# Worktree status

Report drift and merge previews for in-repo worktrees (readonly — no git mutations).

```bash
.cursor/worktree-status.sh          # all worktrees under .worktrees/
.cursor/worktree-status.sh <name>   # one worktree
```

Each `WORKTREE` line includes:

| Field | Meaning |
|-------|---------|
| `behind` | commits on primary not in the worktree branch |
| `ahead` | commits on the worktree branch not in primary |
| `dirty` | uncommitted changes in the worktree checkout |
| `sync` | preview merging primary → worktree: `clean`, `conflict`, or `identical` |
| `apply` | preview merging worktree → primary: `clean`, `conflict`, or `identical` |
| `land` | hint: `ready`, `needs-sync-or-conflict-resolution`, `already-applied`, `same-as-primary` |

Land worktrees with `apply=clean` first. For stale worktrees (`behind>0` or `apply=conflict`), run `/worktree-sync` before `/worktree-apply`.
