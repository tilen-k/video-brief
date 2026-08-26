# VideoBrief — Project Context

Short overview for agents and humans. Full detail: `project-spec.md`. Agent rules: `.cursor/rules/`.

**Brand:** VideoBrief · **Domain:** videobrief.app

## What we're building

**Contextual YouTube summarizer** — personalized section summaries synchronized with the video. Not a chatbot. Not education-first tooling.

```text
Landing → Auth → Onboarding (optional tone + length defaults)
  → Library → Paste URL → Preview metadata (no DB, no usage)
  → Settings under input: length + tone (always); familiarity if category qualifies
  → Generate → create library row + usage + enqueue → redirect workspace
  → Worker: fetch English transcript → generate { summary, sections[] }
  → Workspace: summary + sections; highlight + seek (job continues if user leaves)
```

## Locked stack

| Area | Choice |
|------|--------|
| App | Next.js App Router, React, TS, `src/`, pnpm, Vercel |
| UI | Tailwind, shadcn, lucide, RHF, Zod, TanStack Query |
| Theme / i18n | next-themes (**dark default**), next-intl (**en only** for this ship; DE later) |
| Fonts | Nunito |
| Auth | Supabase email/password + Google; soft email confirm |
| DB | Supabase Postgres + **Drizzle** + RLS |
| AI | Vercel AI SDK behind `AIProvider`; model in `analysisConfig` (OpenRouter) |
| YouTube | `youtubei.js` (EN captions required), `react-youtube` |
| Tests | Vitest unit only (no E2E in MVP) |

**Not in this ship:** chat, uploads, Whisper, tRPC, Prisma, PostHog, app DE / summary-language picker / non-EN transcripts, LLM classify, educational profile fields, shared cross-user transcript cache.

**Billing:** Stripe Checkout + Customer Portal; webhooks sync `profiles.plan` (`free` | `pro`). Redis quotas unchanged.

**Redis:** BullMQ analysis queue + monthly per-user Generate counters (`REDIS_URL`). Not a transcript cache.

## Onboarding (all optional)

Skip allowed → defaults **tone 50**, **length 50**.

| Field | Notes |
|-------|--------|
| Default summary tone | Integer 0–100 (Formal ←→ Casual) |
| Default summary length | Integer 0–100 (Short ←→ Long) |

No YOB, education level, subjects, or `summary_style` enum.

## Per-video prefs (analysis row)

Collected in the library preview panel before Generate:

- **Length** (0–100) — always; default from profile or 50
- **Tone** (0–100, Formal←→Casual) — always; default from profile or 50
- **Familiarity** (0–100) — only for YouTube categories: Education, Howto & Style, Science & Technology, News & Politics (fixed id map). Otherwise null / omitted from prompt.

Re-Generate same URL → **reset** prefs write + new `run_id`.

## Generate (only AI stage)

```text
{ summary, sections: { title, startTime, endTime, body }[] }
```

Inputs: transcript subset + per-video prefs (+ category for familiarity gating). No classify. No edu profile. No non-edu disclaimer.

## Data

All **per-user**. No shared video/transcript cache.

- `user_videos` — metadata + English transcript (created/refreshed on Generate)
- `personalized_analyses` — state machine, prefs, `run_id`, summary, sections, optional `usage_quota_key`
- Profile — `summary_tone`, `summary_length`, **plan** (`free` | `pro`), Stripe customer/subscription ids
- Usage — Redis monthly **Generate** counter (free: 10/month, max 20 min); Pro via Stripe ($10/mo)

## Architecture

Thin Server Actions. Domain `continueAnalysis` advances **one** stage. BullMQ worker loops until complete/failed.

States:

`pending` → `fetching` → `generating` → `complete` | `failed`

## Workspace

Smaller player + sections below; overview summary on the right. Active section from `currentTime`; click seeks. No AI during playback.

## MVP done when

User can sign up, set optional tone/length defaults, preview a YouTube URL with metadata + prefs (no library row yet), Generate (usage + redirect), and watch a personalized overview + section bodies with highlight/seek while the job finishes.

## Guiding question

> Does this help turn a YouTube video into a better personalized understanding for this user?

## Next (not this ship)

App language (en/de), preferred summary language, default-transcript language (drop EN-only caption requirement).
