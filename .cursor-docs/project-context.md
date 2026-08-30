# VideoBrief — Project Context

Short overview for agents and humans. Full detail: `project-spec.md`. Agent rules: `.cursor/rules/`. Focused notes: `docs/`.

**Brand:** VideoBrief · **Domain:** videobrief.app

## What we're building

**Contextual YouTube summarizer** — personalized section summaries synchronized with the video. Not a chatbot. Not education-first tooling.

```text
Home (/) → first visit creates anonymous guest session
  → Paste URL → Preview metadata (no DB, no usage)
  → Settings: length + tone (always); familiarity if category qualifies;
               summary language; basic/advanced model tier
  → Generate → create library row + reserve usage + enqueue → redirect /v/[userVideoId]
  → Worker: fetch captions (preferred summary lang, else video primary) →
            generate { summary, sections[] } in chosen output language
  → Workspace: overview summary + sections; highlight + seek (job continues if user leaves)
  → Optional: Sign up / Google linkIdentity converts guest (same user id) → onboarding
```

## Locked stack

| Area | Choice |
|------|--------|
| App | Next.js App Router, React, TS, `src/`, pnpm · **Vercel** |
| Worker / Redis | BullMQ analysis worker + Redis · **Railway** |
| UI | Tailwind, shadcn, lucide, RHF, Zod, TanStack Query |
| Theme / i18n | next-themes (**system** default), next-intl (**app UI: en only**; DE later) |
| Fonts | Nunito |
| Auth | Supabase email/password + Google + **anonymous guests**; soft email confirm; convert preserves `user.id` |
| DB | Supabase Postgres + **Drizzle** + RLS |
| AI | Vercel AI SDK behind `AIProvider`; models in `analysisConfig` (OpenRouter) |
| YouTube | `youtubei.js` (captions in preferred or primary language), `react-youtube` |
| Billing | Stripe Checkout + Customer Portal; webhooks → `profiles.plan` |
| Tests | Vitest unit only (no E2E) |

**Not in this ship:** chat, uploads, Whisper, tRPC, Prisma, PostHog, non-English **app UI**, LLM classify, educational profile fields, shared cross-user transcript cache.

## Onboarding (after convert; guests skip)

All optional; skip → tone **50**, length **50**, language from Accept-Language (else `en`).

| Field | Notes |
|-------|--------|
| Default summary language | ISO 639-1 from supported list |
| Default summary tone | Integer 0–100 (Formal ←→ Casual) |
| Default summary length | Integer 0–100 (Short ←→ Long) |

No YOB, education level, subjects, or `summary_style` enum.

## Per-video prefs (analysis row)

Collected on home after Preview, before Generate:

- **Length** / **Tone** (0–100) — always; defaults from profile or 50
- **Familiarity** (0–100) — only for YouTube categories: Education, Howto & Style, Science & Technology, News & Politics. Otherwise null / omitted from prompt
- **Summary language** — output language for overview + section bodies (LLM translates if transcript differs)
- **Model tier** — `basic` (~20 min, smaller budget) or `advanced` (up to ~2 h); gated by plan quotas + `ADVANCED_MODEL_ENABLED`

Re-Generate same URL → **reset** (new `run_id`, clear summary/sections, refresh transcript). Prior in-flight usage for that video is refunded when replaced.

## Generate (only AI stage)

```text
{ summary, sections: { title, startTime, endTime, body }[] }
```

Inputs: transcript subset + prefs (length, tone, optional familiarity) + output language. No classify. No edu profile. No non-edu disclaimer.

## Captions

Prefer caption track matching the chosen summary language; else the video’s primary caption language. Missing both → clear error. No Whisper. App UI stays English.

## Data

All **per-user**. No shared video/transcript cache.

- `user_videos` — metadata + transcript snapshot (soft-delete via `deleted_at`); refreshed on Generate
- `personalized_analyses` — state, prefs, `model_tier`, `summary_language`, `run_id`, summary, sections
- `usage_events` — one row per Generate reservation (`run_id`); refunds set `refunded_at`
- Profile — `summary_tone`, `summary_length`, `default_summary_language`, **plan** (`free` \| `pro`), Stripe ids
- Usage — Postgres quotas by plan + tier in `analysisConfig` (user daily, global hourly/daily, optional IP)
- Redis — BullMQ queue + per-video analysis lock (not usage)

## Billing & plans

- Pro **$10/mo** via Stripe Checkout; Customer Portal for manage/cancel
- Webhooks sync `profiles.plan` (Checkout success URL never writes plan)
- Free / Pro daily Generate limits differ per tier (`basic` / `advanced`); see `docs/billing-usage.md`

## Architecture

Thin Server Actions. Domain `continueAnalysis` advances **one** stage. BullMQ worker loops until complete/failed.

States: `pending` → `fetching` → `generating` → `complete` \| `failed`

Detail: `docs/architecture.md`, `docs/analysis-pipeline.md`, `docs/auth-guests.md`, `docs/billing-usage.md`.

## Workspace

`/v/[userVideoId]`: player + sections (highlight/seek) + overview summary pane. No AI during playback.

## Done when

Guest or signed-in user can preview a YouTube URL, set prefs (incl. language + tier), Generate (usage + redirect), and watch a personalized overview + section bodies with highlight/seek while the job finishes — then convert guest → account without losing library/usage.

## Guiding question

> Does this help turn a YouTube video into a better personalized understanding for this user?

## Next (not this ship)

App UI language (en/de). Further caption/language polish as needed.
