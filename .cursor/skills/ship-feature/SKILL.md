---
name: ship-feature
description: >-
  Orchestrate shipping a substantial VideoBrief feature: optional architect
  plan, implement (primary or in-repo worktree), mechanical checks, then
  reviewer / verifier / security subagents. Do not worktree-apply until the
  user explicitly asks after their UI/test pass. Use when the user says
  ship-feature, /ship-feature, or asks to design-implement-review a
  non-trivial feature end-to-end.
---

# Ship feature

Orchestrate a substantial change. Specialists **diagnose**; the main agent **implements**. Do not ask readonly specialists to edit production code.

## When to use

Use for new domain/data/pipeline/auth surfaces or multi-file features.

Skip for copy, CSS, or single-field tweaks — implement directly instead (and skip worktrees per `.cursor/rules/05-worktrees.mdc`).

## Worktree policy

Follow `.cursor/rules/05-worktrees.mdc`. Use **in-repo** worktrees only (`.worktrees/` via repo scripts). Never `~/.cursor/worktrees/`.

| Situation | Checkout |
|-----------|----------|
| Workspace is already `PRIMARY/.worktrees/<name>` | Stay there — reuse it; do not nest another worktree |
| Parallel agent active, conflicting edits, or user asks for isolation | Create/reuse in-repo worktree |
| Solo ship-feature, primary workspace, no conflict | Implement on **primary** |

### Resolve paths (always)

```bash
git worktree list
# Same idea as worktree_primary_root in .cursor/worktree-lib.sh:
common="$(git rev-parse --git-common-dir)"
if [[ "$common" != /* ]]; then
  common="$(cd "$(git rev-parse --show-toplevel)/${common}" && pwd)"
else
  common="$(cd "${common}" && pwd)"
fi
PRIMARY="$(dirname "$common")"
TOPLEVEL="$(git rev-parse --show-toplevel)"
```

If `TOPLEVEL` is `PRIMARY/.worktrees/<name>`, set:

- `WORKTREE_NAME=<name>`
- `WORKTREE_PATH=$TOPLEVEL`
- `CHECKOUT=$WORKTREE_PATH`

Otherwise, when isolation is needed:

```bash
# From PRIMARY (scripts resolve primary even if cwd is a linked worktree)
.cursor/worktree-create.sh <name>    # prints WORKTREE_* lines
```

Reuse an existing `.worktrees/<name>` when `git worktree list` already shows it.

Set `CHECKOUT` to `WORKTREE_PATH` or `PRIMARY`. **Every** read, edit, and shell for this feature uses `CHECKOUT` until the user asks to apply (or until done on primary).

Do **not** merge/rebase/fast-forward the worktree onto primary before implementing. Work at the worktree HEAD; apply only when the user says so (after their improve/test pass).

Do **not** run `db:migrate` from a worktree against shared Supabase unless that is the task.

### Subagents and CHECKOUT

Task subagents share the chat workspace root — they will **not** see worktree edits unless told. Every `architect` / `reviewer` / `verifier` / `security` prompt must include:

```text
CHECKOUT=<absolute path>
All git diff, file reads, and pnpm commands must run with cwd / working_directory = CHECKOUT.
Do not use the primary checkout if CHECKOUT is a .worktrees/ path.
```

## Steps

### 0. Classify

- **Needs architect** if it introduces or changes: domain boundaries, per-user data model, analysis states, Server Action vs route, authz model, or AI pipeline stages (`classifyVideo` / `generateSections`).
- **Needs security** if it touches: auth, RLS, Server Actions writes, user-owned rows, service role, or AI/tool trust boundaries.
- **UI changed** if pages/forms/layouts/i18n on screens change — the human tests that in the browser (see `.cursor/rules/90-ui-verification.mdc`). Agents do not.
- **Checkout** — apply worktree policy above; record `CHECKOUT` (and `WORKTREE_NAME` if any).

### 1. Architect (when needed)

Delegate to the `architect` subagent with the feature goal, constraints, and `CHECKOUT`.

Show the plan to the user if there are open questions. Do not implement until blocking questions are resolved (or the user says to proceed).

### 2. Implement

Main agent implements in `CHECKOUT` against the plan (or against the request if architect was skipped).

If this task has a worktree (`.worktrees/<name>`), implement **there** at the worktree’s current HEAD. Do not merge/rebase onto `main` first. Do not create a second worktree for the same work. Every shell command must `cd` to that path.

Prefer existing skills when relevant:

- `add-server-action`
- `drizzle-table-rls`
- `youtube-ingest`
- `llm-structured-stage`
- `.agents/skills/ai-sdk` for AI SDK usage

### 3. Mechanical checks (in CHECKOUT)

```bash
# cwd = CHECKOUT
pnpm type-check
pnpm lint
pnpm test
```

Fix failures before specialist review.

### 4. Reviewer

Delegate to the `reviewer` subagent. Pass: what was built, key paths, `CHECKOUT`, and that it must inspect `git diff` **in CHECKOUT**.

### 5. Verifier

Delegate to the `verifier` subagent. Pass: claimed behavior, whether UI changed, and `CHECKOUT`.

Do not start `pnpm dev` or use browser tools for UI. Note UI flows for the human to click through. No Playwright.

### 6. Security (when needed)

Delegate to the `security` subagent for auth/data/AI trust changes. Pass `CHECKOUT`.

Optional: user may also run built-in `/review-security` — do not block on it unless asked.

### 7. Fix and re-check

Main agent fixes **Critical** and **High** findings that are valid — still in `CHECKOUT`.

Re-run verifier (and security if it had Critical/High) after substantive fixes.

Do not expand scope into unrelated refactors.

### 8. Pause for human (default — do **not** auto-apply)

After step 7, **stop**. Do **not** run `worktree-apply.sh` / `worktree-delete.sh` unless the user explicitly asks (e.g. `/worktree-apply`, “apply the worktree”, “land it”).

The human improves and tests in the browser on the worktree (or primary if that was `CHECKOUT`). Agents do not drive the browser (see `.cursor/rules/90-ui-verification.mdc`).

Report **READY** (below) with `WORKTREE_PATH`, what to click through, and that apply is waiting on them.

If they request more fixes, stay in `CHECKOUT` and re-run checks / specialists as needed — still no apply until they ask.

### 9. Land worktree (only when the user explicitly asks)

Skip if work stayed on primary, or if the user has not asked to apply yet.

From **primary** (scripts resolve primary if cwd is linked):

```bash
.cursor/worktree-apply.sh <WORKTREE_NAME>
```

Apply commits any remaining uncommitted worktree changes, then merges `wt/<name>` into the primary branch.

Then on **primary**:

```bash
pnpm type-check
pnpm lint
pnpm test
```

Fix merge/check failures on primary. Re-run verifier on primary only if the merge changed behavior or conflict resolutions were non-trivial.

Then delete unless the user asked to keep the worktree:

```bash
.cursor/worktree-delete.sh <WORKTREE_NAME>
```

Land **one** worktree at a time. Run `db:migrate` on **primary** only when the landed change includes a migration and the user wants shared DB updated (not from the worktree).

### 10. Final report

After step 7 (waiting on human):

```text
READY — <feature> (not applied)

Checkout
- worktree <name> at WORKTREE_PATH=… | primary

Done
- …

Architect decisions (if any)
- …

Findings fixed
- …

Deferred / residual
- …

Verified
- type-check / lint / test (CHECKOUT): …
- UI for human: … (click-through list)
- Next: human tests/improves; say /worktree-apply <name> when ready to land
```

After step 9 (user asked to apply):

```text
SHIPPED — <feature>

Checkout
- worktree <name> → applied | kept open

Done
- …

Findings fixed
- …

Deferred / residual
- …

Verified
- type-check / lint / test (CHECKOUT): …
- type-check / lint / test (primary after apply): …
- UI for human: … (or already signed off)
- db:migrate: done | still needed on primary | N/A
```

## Trust boundary

| Role | Writes production code? |
|------|-------------------------|
| Main agent | Yes |
| architect / reviewer / verifier / security | No (`readonly`) |

Verifier may write tests only if the user explicitly asks.

## Invocation examples

- `/ship-feature` paste YouTube URL into library and start analysis
- Ship onboarding persistence end-to-end
- Design then build context-questions stage
- `/ship-feature` in worktree `usage-limits` (reuse existing `.worktrees/usage-limits`)
