# VideoBrief — Project Context

Short overview for agents and humans. Full detail: `project-spec.md`. Agent rules: `.cursor/rules/`.

**Brand:** VideoBrief · **Domain:** videobrief.app

## What we're building

Paste a YouTube URL → get a **personalized**, timestamp-synced summary. Same video, different users, different emphasis. Not a chatbot. Not a generic summarizer.

```text
Landing → Auth → Onboarding → Library → Paste URL
  → Metadata + English transcript → Analyze
  → Optional context questions → Persist useful answers
  → Personalized summary → Video workspace (synced chapters)
```

## Locked stack

| Area | Choice |
|------|--------|
| App | Next.js App Router, React, TS, `src/`, pnpm, Vercel |
| UI | Tailwind, shadcn, lucide, RHF, Zod, TanStack Query |
| Theme / i18n | next-themes (**dark default**), next-intl (**en only**) |
| Fonts | Newsreader + Source Sans 3 |
| Auth | Supabase email/password + Google; soft email confirm |
| DB | Supabase Postgres + **Drizzle** + RLS |
| AI | Vercel AI SDK → **Claude Haiku**; Zod-validate outputs |
| YouTube | `youtubei.js` (EN captions required), `react-youtube` |
| Tests | Vitest unit only (no E2E in MVP) |

**Not in MVP:** chat, uploads, Whisper, Redis, workers, tRPC, Prisma, Stripe, PostHog, non-English UI/captions.

## Hybrid data

- **Shared** by YouTube id: video metadata + English transcript
- **Per-user:** library, context, personalized analysis

## Architecture

Thin Server Actions → domain pipeline (`analyzeVideo`, etc.) → Drizzle / TranscriptProvider / AIProvider. Pipeline must be movable to a worker later without rewrite. Transcript provider must be swappable if Vercel IPs get blocked (no proxy on day one).

## Context scopes

Global · Topic · Video-specific. Ask only useful missing questions; zero answers still produce a summary.

## MVP done when

User can sign up, onboard lightly, paste a real YouTube URL with English captions, optionally answer context questions, and watch with synced personalized chapters — then reopen it from the library.

## Guiding question

> Does this help turn a YouTube video into a better personalized understanding for this user?
