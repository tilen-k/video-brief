<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VideoBrief

Education-first personalized YouTube summaries synced with the video. Not a chatbot. Not a generic AI summarizer. Non-educational videos still get a sectioned summary with a soft disclaimer.

## Context

- Short overview: `project-context.md`
- Full spec: `project-spec.md`
- Agent rules: `.cursor/rules/`
- Workflow skills: `.cursor/skills/`
- Specialist subagents: `.cursor/agents/` (`architect`, `reviewer`, `verifier`, `security`)

## Shipping substantial features

For non-trivial work, prefer `/ship-feature` (or say “ship this feature”):

1. `architect` (readonly) — plan boundaries **before** coding when domain/data/pipeline/authz change
2. Main agent implements (use existing skills)
3. `reviewer` + `verifier` (readonly) — critique and prove it works (Vitest; no Playwright). The human tests UI in the browser.
4. `security` when auth/RLS/AI trust boundaries change
5. Main agent fixes Critical/High; specialists do not rewrite production code

Skip the full loop for copy/CSS/one-field tweaks. Explicit `/architect`, `/reviewer`, `/verifier`, or `/security` is fine mid-feature.

## Parallel agents

Subagents in this chat share the same checkout. Independent writing tasks (CSS, copy, a second feature) need a worktree or a cloud agent so tests and edits do not collide.

**Skip worktrees** for isolated one-field copy/CSS/i18n when no other agent is active — edit the primary checkout.

**In-repo worktrees** (sandbox-safe, no approval card):

```bash
.cursor/worktree-create.sh [name] [start-ref]   # → WORKTREE_PATH under .worktrees/
.cursor/worktree-apply.sh <name>                # merge into current branch
.cursor/worktree-delete.sh <name>
```

Do **not** create worktrees under `~/.cursor/worktrees/` for this repo. Reuse an existing entry from `git worktree list` before creating another.

Do **not** merge/rebase/fast-forward a worktree onto primary/`main` before implementing. Work at the worktree’s current HEAD. Integrate with `worktree-apply.sh` later.

`.cursor/worktrees.json` bootstrap: copy `.env.local`, then `pnpm install --trust-lockfile --prefer-offline` from the default pnpm store (do not request extra network permissions). Do **not** run `db:migrate` from a worktree against shared Supabase unless that *is* the task. Land one result at a time, then type-check, lint, and test in the primary checkout.

See `.cursor/rules/05-worktrees.mdc`.

## Hard constraints (MVP)

- Stack: Next.js App Router (`src/`), Drizzle (not Prisma), Vitest unit tests only (no Playwright/E2E)
- AI: Vercel AI SDK behind `AIProvider` (`classifyVideo`, `generateSections`); Zod-validate all structured LLM output before persist; model in `analysisConfig`
- YouTube English captions only; domain pipeline in `src/domain/` (not in Server Actions or UI)
- Per-user `user_videos` — paste stubs then redirects; re-paste refreshes; no shared transcript/classification cache
- Typed profile (not EAV); per-video prefs on the analysis row
- No lint/type suppressions without justification — see `.cursor/rules/15-code-quality.mdc`
- No chat, uploads, Whisper, Redis, workers, tRPC, Stripe, analytics, or LLM-invented knowledge questions in MVP

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
