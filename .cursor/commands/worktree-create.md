# Create in-repo worktree

Run from repo root **in the default sandbox** (do not request `full_network` or `all`):

```bash
.cursor/worktree-create.sh [name] [start-ref]
```

- Creates `.worktrees/<name>/` on branch `wt/<name>` (sandbox-safe — no `~/.cursor/worktrees/`).
- If that worktree already exists, reuses it.
- Runs setup: copies `.env.local`, then `pnpm install --trust-lockfile --prefer-offline` from the default pnpm store (no registry metadata pass). This should finish in seconds.
- Parse `WORKTREE_PATH=` from output; use that path for all edits until apply/delete.

Before creating, run `git worktree list` and reuse an existing worktree when possible.

Skip worktree for isolated copy/CSS/one-field i18n when no parallel agent is active.
