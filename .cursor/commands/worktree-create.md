# Create in-repo worktree

Run from repo root **in the default sandbox** (do not request `full_network` or `all`):

```bash
.cursor/worktree-create.sh [name] [start-ref]
```

- Creates `.worktrees/<name>/` on branch `wt/<name>` (sandbox-safe — no `~/.cursor/worktrees/`).
- If that worktree already exists, reuses it.
- Runs setup (`.cursor/setup-worktree-unix.sh`): copies `.env.local`, then **hardlink-clones** `node_modules` from primary (seconds). Falls back to offline `pnpm install --frozen-store` with a 90s timeout only if primary has no usable modules.
- Do **not** bare-`pnpm install` in the sandbox — Cursor remaps the store to an incomplete in-repo `.pnpm-store` and install can hang forever on the proxy. If setup hangs, kill it and re-run after primary `pnpm install` is complete.
- Parse `WORKTREE_PATH=` from output; use that path for **all** edits and shell until apply/delete. Cursor’s default cwd is the **primary checkout** — `cd` to `WORKTREE_PATH` (or set `working_directory`) on every command.

Before creating, run `git worktree list`. If the user says to use the current/existing worktree, or one already exists for this work, **use that path** — do not create another named worktree. Reuse it **as-is** (even if `main` is ahead).

**Do not catch up onto primary/`main` before implementing.** No merge, rebase, pull, or `reset --hard` onto main. Other agents’ work is usually isolated. Stay on the worktree’s current HEAD; integrate with `worktree-apply.sh` later.

Skip worktree for isolated copy/CSS/one-field i18n when no parallel agent is active.
