---
name: ship-feature
description: >-
  Orchestrate shipping a substantial VideoBrief feature: optional architect
  plan, implement (primary or in-repo worktree), mechanical checks, then
  reviewer / verifier / security subagents, then land worktree if used. Use
  when the user says ship-feature, /ship-feature, or asks to
  design-implement-review a non-trivial feature end-to-end.
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

Set `CHECKOUT` to `WORKTREE_PATH` or `PRIMARY`. **Every** read, edit, and shell for this feature uses `CHECKOUT` until land (or until done on primary).

Do **not** merge/rebase/fast-forward the worktree onto primary before implementing. Work at the worktree HEAD; land with apply later.

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

### 8. Land worktree (when CHECKOUT is a worktree)

Skip this step if work stayed on primary.

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

Land **one** worktree at a time.

### 9. Final report

```text
SHIPPED — <feature>

Checkout
- primary | worktree <name> → applied | kept open

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
- type-check / lint / test (primary after apply): … (or N/A)
- UI for human: … (or N/A)
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
