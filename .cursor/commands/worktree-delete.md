# Delete worktree

Remove an in-repo worktree and its branch after changes are applied (or abandoned).

```bash
.cursor/worktree-delete.sh <name>
```

Apply first with `/worktree-apply` unless discarding work.

For legacy worktrees under `~/.cursor/worktrees/` (created before in-repo scripts):

```bash
git worktree remove /path/to/worktree --force
git worktree prune
```
