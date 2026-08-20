<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VideoBrief

Personalized YouTube summaries synced with the video. Not a chatbot. Not a generic AI summarizer.

## Context

- Short overview: `project-context.md`
- Full spec: `project-spec.md`
- Agent rules: `.cursor/rules/`
- Workflow skills: `.cursor/skills/`

## Hard constraints (MVP)

- Stack: Next.js App Router (`src/`), Drizzle (not Prisma), Vitest unit tests only (no Playwright/E2E)
- AI: Vercel AI SDK + Claude Haiku; Zod-validate all structured LLM output before persist
- YouTube English captions only; domain pipeline in `src/domain/` (not in Server Actions or UI)
- No chat, uploads, Whisper, Redis, workers, tRPC, Stripe, or analytics in MVP

## UI verification

For UI changes: with `pnpm dev` running, use the Cursor browser tools against `http://localhost:3000`. Snapshot, click the real flow, screenshot if layout matters. Do not add Playwright.

## Before finishing work that changed code

```bash
pnpm type-check
pnpm lint
pnpm test
```

A project `stop` hook also runs these after Agent file edits.
