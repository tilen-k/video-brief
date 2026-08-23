# VideoBrief — Project Context

Short overview for agents and humans. Full detail: `project-spec.md`. Agent rules: `.cursor/rules/`.

**Brand:** VideoBrief · **Domain:** videobrief.app

## What we're building

**Education-first** personalized YouTube summaries, synchronized with the video.

Paste a URL → classify whether it is educational → for educational videos, ask only missing knowledge questions → generate **sections** explained with the user's context → watch with synced highlight/seek. Not a chatbot. Not a generic summarizer.

Non-educational videos are still allowed: soft disclaimer, **no** paste-time questions, sectioned summary that still uses global context when present.

```text
Landing → Auth → Onboarding → Library → Paste URL
  → Metadata + English transcript
  → Classify (isEducational + domains/prereqs; YouTube category as hint)
  → If educational: optional select questions (max 3) for missing knowledge
       + show context that will be used
  → If not: soft disclaimer → skip questions
  → Personalized section summaries → Video workspace (sync + seek)
```

## Locked stack

| Area | Choice |
|------|--------|
| App | Next.js App Router, React, TS, `src/`, pnpm, Vercel |
| UI | Tailwind, shadcn, lucide, RHF, Zod, TanStack Query |
| Theme / i18n | next-themes (**dark default**), next-intl (**en only**) |
| Fonts | Nunito |
| Auth | Supabase email/password + Google; soft email confirm |
| DB | Supabase Postgres + **Drizzle** + RLS |
| AI | Vercel AI SDK → **Claude Haiku**; Zod-validate outputs |
| YouTube | `youtubei.js` (EN captions required), `react-youtube` |
| Tests | Vitest unit only (no E2E in MVP) |

**Not in MVP:** chat, uploads, Whisper, Redis, workers, tRPC, Prisma, Stripe, PostHog, non-English UI/captions.

## Onboarding (all optional)

Stable educational baseline — skip allowed:

| Field | Notes |
|-------|--------|
| Year of birth | Number → store `yyyy`; framing only (not gating) |
| Education level | Enum: `middle_school`, `high_school`, `undergrad`, `grad`, `bootcamp`, `self_taught`, `other` |
| Subjects | Fixed chips + `other` last; no free-text for Other in MVP |

Suggested subject chips: Math, Physics, Chemistry, Biology, Computer Science, Engineering, Economics, History, Languages, Other.

## Classification

LLM structured stage (Zod-validated), persisted on shared video:

```text
isEducational, confidence, domains[], prerequisites[], youtubeCategoryId?
```

YouTube `categoryId` is a **hint**, not the decision. If confidence is ambiguous, **prefer educational** so the core learning loop is not starved.

## Context scopes

Global · Topic · Video-specific.

- Educational: ask only useful **missing** knowledge questions; **select-only**, **max 3**; zero answers still produce a summary.
- Non-educational: no questions; still use global context in the summary; soft disclaimer.

## Hybrid data

- **Shared** by YouTube id: metadata, English transcript, classification + section skeleton (non-personalized)
- **Per-user:** library, context, personalized section explanations

## Architecture

Thin Server Actions → domain pipeline (`analyzeVideo`, etc.) → Drizzle / TranscriptProvider / AIProvider. Pipeline must be movable to a worker later without rewrite. Transcript provider must be swappable if Vercel IPs get blocked (no proxy on day one).

## Workspace

Video + section panel. Sections may be a single section for short videos. Active section highlights from `currentTime`; click seeks. No AI calls during playback.

## MVP done when

User can sign up, onboard lightly (educational baseline), paste a real YouTube URL with English captions, see edu vs non-edu behavior, optionally answer up to 3 select questions when educational, and watch with synced personalized sections — then reopen from the library.

## Guiding question

> Does this help turn a YouTube video into a better personalized understanding for this user — especially for learning?
