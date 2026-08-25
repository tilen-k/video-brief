# Apply worktree changes

Merge a worktree branch into the primary checkout **when you are ready** (after improve/UI testing). `/ship-feature` does **not** run this automatically — you trigger it.

```bash
.cursor/worktree-apply.sh <name>
```

- Commits any uncommitted changes in the worktree first.
- Merges `wt/<name>` into the current branch.
- Then run `pnpm type-check`, `pnpm lint`, `pnpm test` in the primary checkout.
- Then usually `/worktree-delete` unless keeping the worktree.

Use `<name>` from `worktree-create.sh` output (`WORKTREE_NAME=`) or the last segment of `.worktrees/<name>/`.
