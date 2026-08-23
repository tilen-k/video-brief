# VideoBrief — Project Context

Short overview for agents and humans. Full detail: `project-spec.md`. Agent rules: `.cursor/rules/`.

**Brand:** VideoBrief · **Domain:** videobrief.app

## What we're building

**Education-first** personalized YouTube summaries, synchronized with the video.

Paste a URL → immediately open the workspace → fetch metadata + English transcript → classify → optional **fixed** per-video prefs → generate **section bodies** from profile + those prefs → watch with synced highlight/seek. Not a chatbot. Not a generic summarizer.

Non-educational videos still get a sectioned summary (soft disclaimer). No familiarity question.

```text
Landing → Auth → Onboarding → Library → Paste URL
  → Stub library row + redirect to workspace
  → Fetch metadata + English transcript (fail in workspace)
  → Classify (isEducational, topic; YouTube category as hint)
  → If educational: optional familiarity (3 levels) when a topic is known
  → Optional summary length (3 levels; default from profile summary_style)
  → Generate sections { title, startTime, endTime, body }
  → Workspace: highlight active section from currentTime; click seeks
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

**Not in MVP:** chat, uploads, Whisper, Redis, workers, tRPC, Prisma, Stripe, PostHog, non-English UI/captions, LLM-invented knowledge questions, topic/video EAV context, shared cross-user transcript/classification cache.

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

Product-owned selects, skippable. Persist on the **analysis row** (not the profile):

- **Familiarity** (educational + topic known): How familiar with {topic}? `not_familiar` / `somewhat` / `very`
- **Length** (when appropriate): How detailed? `brief` / `moderate` / `extensive` — default from profile `summary_style` or `moderate`

User may answer zero, some, or all. Summary still generates.

## Generate (stage 2)

After prefs (or skip). One call returns sections with **bodies**:

```text
{ title, startTime, endTime, body }[]
```

Uses transcript subset + profile + per-video prefs. Personalization changes depth/framing — does not invent unrelated facts. Non-edu still uses profile when present.

## Data

All **per-user**. No shared video/transcript/classification cache.

- `user_videos` — metadata + English transcript (re-paste refreshes)
- `personalized_analyses` — state machine, classify result, per-video prefs, generated sections
- Profile / preferences — typed columns: YOB, education level, subjects, summary style

## Architecture

Thin Server Actions → domain pipeline → Drizzle / TranscriptProvider / AIProvider (`classifyVideo`, `generateSections`). Pipeline must be movable to a worker later. Transcript provider swappable if Vercel IPs get blocked.

States (keep simple):

`pending` → `fetching` → `classifying` → `awaiting` → `generating` → `complete` | `failed`

Skip `awaiting` when there is nothing to ask (non-edu, or neither question is appropriate).

## Workspace

Video + section panel. Active section from `currentTime`; click seeks. No AI during playback.

## MVP done when

User can sign up, onboard lightly, paste a YouTube URL with English captions, land on the workspace immediately, see edu vs non-edu behavior, optionally set familiarity/length, and watch **personalized section bodies** with highlight + seek — then reopen from the library.

## Guiding question

> Does this help turn a YouTube video into a better personalized understanding for this user — especially for learning?
