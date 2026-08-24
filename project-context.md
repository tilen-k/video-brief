# VideoBrief — Project Context

Short overview for agents and humans. Full detail: `project-spec.md`. Agent rules: `.cursor/rules/`.

**Brand:** VideoBrief · **Domain:** videobrief.app

## What we're building

**Education-first** personalized YouTube summaries, synchronized with the video.

Paste a URL with familiarity/length sliders → stay on the library → a worker fetches metadata + English transcript → classify → generate an **overview summary** plus **section bodies** from profile + those prefs → open the workspace anytime and watch with synced highlight/seek. Not a chatbot. Not a generic summarizer.

Non-educational videos still get a sectioned summary (soft disclaimer). Familiarity is omitted from the generate prompt.

```text
Landing → Auth → Onboarding → Library → Paste URL + sliders
  → Stub library row (no redirect) + enqueue analyze job
  → Fetch metadata + English transcript (fail on workspace / library row)
  → Classify (isEducational, topic; YouTube category as hint)
  → Generate { summary, sections: { title, startTime, endTime, body } }
  → Workspace: summary on the right; sections under a smaller player; highlight + seek
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
| AI | Vercel AI SDK behind `AIProvider`; default model in `analysisConfig` (OpenRouter) |
| YouTube | `youtubei.js` (EN captions required), `react-youtube` |
| Tests | Vitest unit only (no E2E in MVP) |

**Not in MVP:** chat, uploads, Whisper, tRPC, Prisma, Stripe, PostHog, non-English UI/captions, LLM-invented knowledge questions, topic/video EAV context, shared cross-user transcript/classification cache. Redis/BullMQ is the analysis queue only.

## Onboarding (all optional)

Stable profile — skip allowed. Typed fields (not open key/value):

| Field | Notes |
|-------|--------|
| Year of birth | Number → store `yyyy`; framing only |
| Education level | Enum: `middle_school`, `high_school`, `undergrad`, `grad`, `bootcamp`, `self_taught`, `other` |
| Subjects | Fixed chips + `other` last; no free-text for Other in MVP |
| Summary style | Optional global default for length (`brief` / `moderate` / `extensive`); settings later if not collected at onboarding |

Suggested subject chips: Math, Physics, Chemistry, Biology, Computer Science, Engineering, Economics, History, Languages, Other.

## Classification (stage 1)

Cheap structured call. **No** section skeleton, **no** dynamic questions.

```text
isEducational, confidence, topic?
```

YouTube `categoryId` is a **hint**. Ambiguous → **prefer educational**.

## Per-video prefs (not global context)

Paste-time sliders. Persist on the **analysis row** (not the profile) as integers 0–100:

- **Familiarity** — default 50. Omitted from the generate prompt when the video is not educational.
- **Length** — default from profile `summary_style` (brief 25 / moderate 50 / extensive 75) or 50.

Re-paste overwrites both and mints a new `run_id`.

## Generate (stage 2)

One call returns an overview plus timed sections:

```text
{ summary, sections: { title, startTime, endTime, body }[] }
```

Uses transcript subset + profile + per-video prefs. Personalization changes depth/framing — does not invent unrelated facts. Non-edu still uses profile when present.

## Data

All **per-user**. No shared video/transcript/classification cache.

- `user_videos` — metadata + English transcript (re-paste refreshes)
- `personalized_analyses` — state machine, classify result, 0–100 prefs, `run_id`, overview summary, generated sections
- Profile / preferences — typed columns: YOB, education level, subjects, summary style

## Architecture

Thin Server Actions enqueue work. Domain `continueAnalysis` still advances **one** stage. A BullMQ worker loops it until complete/failed. Optional `YOUTUBE_PROXY_URL` for YouTube fetch on Vercel (same TranscriptProvider).

States (keep simple):

`pending` → `fetching` → `classifying` → `generating` → `complete` | `failed`

## Workspace

Smaller player + sections below; overview summary on the right. Active section from `currentTime`; click seeks. No AI during playback.

## MVP done when

User can sign up, onboard lightly, paste a YouTube URL with English captions, stay on the library while analysis runs, open the workspace anytime, see edu vs non-edu behavior, and watch a **personalized overview + section bodies** with highlight + seek.

## Guiding question

> Does this help turn a YouTube video into a better personalized understanding for this user — especially for learning?
