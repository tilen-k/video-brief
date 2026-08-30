<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VideoBrief

Contextual YouTube summarizer — personalized section summaries synced with the video. Not a chatbot. Not education-first tooling.

## Context

- Short overview: `project-context.md`
- Full spec: `project-spec.md`
- Agent rules: `.cursor/rules/`
- Workflow skills: `.cursor/skills/`
- Specialist subagents: `.cursor/agents/` (`architect`, `reviewer`, `verifier`, `security`)

## Shipping substantial features

For non-trivial work, prefer `/ship-feature` (or say “ship this feature”):

1. `architect` (readonly) — plan boundaries **before** coding when domain/data/pipeline/authz change
2. Main agent implements (use existing skills) — on primary, or in an in-repo worktree when parallel/isolated (see skill + `.cursor/rules/05-worktrees.mdc`)
3. `reviewer` + `verifier` (readonly) — critique and prove it works (Vitest; no Playwright). Pass absolute `CHECKOUT` so they inspect the worktree when used. The human tests UI in the browser.
4. `security` when auth/RLS/AI trust boundaries change
5. Main agent fixes Critical/High; specialists do not rewrite production code
6. **Pause** — human improves / click-tests. Do **not** auto-apply.
7. Only when the user asks (`/worktree-apply` or “land it”): `worktree-apply.sh` → type-check/lint/test on primary. Do **not** delete the worktree until they run `/worktree-delete`.

Skip the full loop for copy/CSS/one-field tweaks. Explicit `/architect`, `/reviewer`, `/verifier`, or `/security` is fine mid-feature.

## Parallel agents

Subagents in this chat share the same checkout. Independent writing tasks (CSS, copy, a second feature) need a worktree or a cloud agent so tests and edits do not collide.

**Skip worktrees** for isolated one-field copy/CSS/i18n when no other agent is active — edit the primary checkout.

**In-repo worktrees** (sandbox-safe, no approval card):

```bash
.cursor/worktree-create.sh [name] [start-ref]   # → WORKTREE_PATH under .worktrees/
.cursor/worktree-status.sh [name]               # drift + merge previews (readonly)
.cursor/worktree-sync.sh <name>                 # merge primary into worktree (after siblings land)
.cursor/worktree-apply.sh <name>                # merge into current branch
.cursor/worktree-delete.sh <name>
```

Do **not** create worktrees under `~/.cursor/worktrees/` for this repo. If the user says to use the current worktree, or `git worktree list` already has one for this work, use that path **as-is** — do not create another.

Every shell command for that task must `cd` to `WORKTREE_PATH` (Cursor’s default cwd is the primary checkout). Do **not** merge/rebase/pull/`reset --hard` a worktree onto primary/`main` before implementing — stay on the worktree’s HEAD even if main is ahead. Integrate with `worktree-apply.sh` later.

`.cursor/worktrees.json` / `setup-worktree-unix.sh` bootstrap: copy `.env.local`, then hardlink-clone `node_modules` from primary (do not bare-`pnpm install` in the sandbox — store remap hangs). Do **not** run `db:migrate` from a worktree against shared Supabase unless that *is* the task. Apply one worktree at a time **after the human asks**, then type-check, lint, and test in the primary checkout.

See `.cursor/rules/05-worktrees.mdc`.

## Hard constraints (MVP)

- Stack: Next.js App Router (`src/`), Drizzle (not Prisma), Vitest unit tests only (no Playwright/E2E)
- AI: Vercel AI SDK behind `AIProvider` (`generateSections` only); Zod-validate structured LLM output before persist; model in `analysisConfig`
- YouTube English captions only; domain pipeline in `src/domain/` (not in Server Actions or UI)
- Per-user `user_videos` — Preview is ephemeral; Generate creates the row + usage; worker runs fetch→generate; re-Generate resets; no shared transcript cache
- Typed profile defaults (tone/length); per-video 0–100 prefs (length, tone, optional familiarity) on the analysis row
- No lint/type suppressions without justification — see `.cursor/rules/15-code-quality.mdc`
- No chat, uploads, Whisper, tRPC, analytics, or LLM-invented knowledge questions in MVP
- Billing: Stripe Checkout + Customer Portal; webhooks update `profiles.plan` (not Checkout success URL)
- Redis + BullMQ: analysis queue, per-video lock, and monthly usage counters (not a transcript cache)

## UI verification

The human tests UI in the browser. Agents finish at type-check / lint / test. Do **not** use Cursor browser tools unless explicitly asked. Do not add Playwright.

See `.cursor/rules/90-ui-verification.mdc`.

## Before finishing work that changed code

```bash
pnpm type-check
pnpm lint
pnpm test
```

A project `stop` hook also runs these after Agent file edits.
