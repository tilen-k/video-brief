# Create in-repo worktree

Run from repo root:

```bash
.cursor/worktree-create.sh [name] [start-ref]
```

- Creates `.worktrees/<name>/` on branch `wt/<name>` (sandbox-safe — no `~/.cursor/worktrees/`).
- Runs setup (`pnpm install`, copies `.env.local`).
- Parse `WORKTREE_PATH=` from output; use that path for all edits until apply/delete.

Before creating, run `git worktree list` and reuse an existing worktree when possible.

Skip worktree for isolated copy/CSS/one-field i18n when no parallel agent is active.
