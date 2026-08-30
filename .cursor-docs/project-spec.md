# VideoBrief — Project Spec

Brand: **VideoBrief** · Domain: **videobrief.app**

Canonical agent rules live in `.cursor/rules/`. Short overview: `project-context.md`. Focused engineering notes: `docs/` (architecture, analysis pipeline, auth/guests, billing/usage).

## 1. Project Overview

We are building a **contextual YouTube summarizer**: personalized, interactive section summaries synchronized with playback.

The core product idea is:

> **Paste a YouTube URL. Preview metadata and set summary prefs on home. Generate a personalized sectioned summary and watch it synced with the video.**

Not a chatbot. Not education-first tooling. Personalization comes from **per-video length, tone, (when category qualifies) familiarity, summary language, and model tier** — plus optional profile defaults.

A user should be able to use the application with almost no configuration:

1. First visit creates an **anonymous guest** session (same auth user id as a future account).
2. On **home** (`/`): paste a YouTube URL and **Preview** (metadata only — title, thumb, channel, duration, category). **No** library row, **no** usage yet.
3. Under the input: summary settings — length and tone always; familiarity for qualifying YouTube categories; summary language; basic/advanced model tier.
4. **Generate** → create `user_videos` + analysis, reserve usage, enqueue worker, **redirect to workspace** (job continues if they leave).
5. Worker fetches captions (preferred summary language, else video primary) → generates `{ summary, sections[] }` in the chosen output language.
6. User watches with synchronized section highlight and seek.
7. Optional: sign up / Google `linkIdentity` converts the guest (**same `user.id`**) → lightweight onboarding (tone, length, default summary language).

**Familiarity categories** (YouTube category id map; may extend later): Education, Howto & Style, Science & Technology, News & Politics.

There is **no** AI classify stage and **no** non-edu disclaimer.

---

# 2. Product Philosophy

The application should feel like a **personalized video understanding tool**, not an AI chatbot.

Primary interaction: **Watch → understand → remember**

AI stays largely invisible in the workspace. Prefer useful sections and summaries over chat.

MVP does one thing well:

> **Turn a YouTube video into a contextual, synchronized section summary shaped by length, tone, optional familiarity, output language, and model tier.**

---

# 3. Core User Flow

## 3.1 Home (app surface)

Home **is** the library / composer — there is no separate marketing landing in the app. Paste bar first; video inventory below. Guests see a this-browser-only / save-account nudge.

## 3.2 Authentication

```text
First visit → anonymous guest → Home
Optional: Sign up / Log in (convert or switch) → Onboarding (if needed) → Home
```

Supabase Auth: email/password, Google OAuth, **anonymous guests**, soft email confirmation.

Guest convert keeps `auth.users.id` stable (`updateUser` for email/password; `linkIdentity` for Google). Guests skip the onboarding gate. Detail: `docs/auth-guests.md`.

---

# 3.3 Technology Stack (Locked)

Do not substitute these without an explicit product decision.

### Application

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router, React, TypeScript (`src/` layout) |
| Package manager | pnpm |
| Hosting (web) | Vercel |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| Forms | React Hook Form + Zod |
| Client data | TanStack Query (mutations + analysis-status polling; RSC for primary reads) |
| Theme | next-themes, **system** default (`enableSystem`) |
| i18n | next-intl, **English app UI only** (German UI later) |
| Fonts | **Nunito** (display/brand and UI/body) |

### Data & auth

| Layer | Choice |
|-------|--------|
| Auth | Supabase Auth (email/password + Google + anonymous guests) |
| Database | Supabase PostgreSQL |
| ORM / migrations | Drizzle ORM + Drizzle Kit |
| Session | `@supabase/ssr` |
| Authorization | App checks + Postgres RLS |

### AI

| Layer | Choice |
|-------|--------|
| SDK | Vercel AI SDK behind `AIProvider` abstraction |
| Models | `analysisConfig` (OpenRouter): `basic` + `advanced` ids |
| Output | Structured + Zod-validated before persist |

### YouTube

| Layer | Choice |
|-------|--------|
| Transcript / metadata | `youtubei.js` behind `TranscriptProvider` |
| Captions | Prefer track matching **summary language**, else video **primary** language; missing → clear error |
| Player | `react-youtube` (IFrame API for seek/time sync) |
| Prod fetch risk | Optional `YOUTUBE_PROXY_URL` for Innertube/captions when datacenter IPs are blocked |

### Queue, worker & usage

| Layer | Choice |
|-------|--------|
| Redis | BullMQ analysis queue + per-video lock (**Railway**) |
| Worker | BullMQ analysis runner (**Railway**, separate process) |
| Usage | Postgres `usage_events` (user daily / global hourly+daily / optional IP daily, per model tier) |

### Billing

| Layer | Choice |
|-------|--------|
| Payments | Stripe Checkout (`mode: subscription`) + Customer Portal |
| Entitlement | Webhooks update `profiles.plan` (`free` \| `pro`); Pro **$10/mo** |
| Secrets | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY` |

### Testing

| Layer | Choice |
|-------|--------|
| Unit | Vitest (+ Testing Library as needed) |
| E2E | Out of scope (no Playwright) |

### Explicitly not in this ship

Prisma, tRPC, PostHog/analytics, Jest, Playwright, Whisper/audio transcription, non-English **app UI**, AI classify / educational profile fields.

### Recommended MCP (Cursor)

* Supabase MCP (prefer read-only) for schema/RLS inspection
* Humans test UI in the browser; agents do not use cursor-ide-browser unless asked

---

# 4. Onboarding

Runs after guest → permanent convert (guests never see it). All fields optional; skip allowed → defaults **tone 50**, **length 50**, language from Accept-Language (else `en`).

| Field | Storage / behavior |
|-------|--------------------|
| Default summary language | ISO 639-1 (`default_summary_language`); lazy-seeded for guests from Accept-Language |
| Default summary tone | Integer 0–100 (Formal ←→ Casual) |
| Default summary length | Integer 0–100 (Short ←→ Long) |

Persist as typed profile columns. Editable later under Account → Profile.

**Removed from product:** year of birth, education level, subjects, `summary_style` enum.

---

# 5. Two kinds of context

## 5.1 Profile (stable defaults)

```text
summary_tone               # 0–100, default 50
summary_length             # 0–100, default 50
default_summary_language   # ISO 639-1; null until seeded
plan                       # free | pro
stripe_*                   # customer / subscription ids + status
```

## 5.2 Per-video prefs

Collected on **home** after Preview, before Generate; stored on the analysis row:

```text
summary_length     # 0–100 — always
summary_tone       # 0–100 — always
familiarity        # 0–100 or null — only when category qualifies
summary_language   # ISO 639-1 — output language for this run
model_tier         # basic | advanced
```

Slider labels: length Short←→Long; tone Formal←→Casual; familiarity Novice←→Expert (or equivalent).

These shape **this** summary only.

---

# 6. Familiarity gating (YouTube category)

Show familiarity only when `youtube_category_id` maps to:

* Education
* Howto & Style
* Science & Technology
* News & Politics

Use a frozen id→label map in code (extend later). Otherwise hide the slider and omit familiarity from the generate prompt.

---

# 7. Model tiers

Two Generate tiers (ids and caps in `analysisConfig`, not env):

| Tier | Duration cap (approx.) | Role |
|------|------------------------|------|
| `basic` | ~20 minutes | Default / cheaper path |
| `advanced` | ~2 hours | Longer videos + larger transcript/output budget |

`ADVANCED_MODEL_ENABLED=0` disables the advanced tier at runtime. UI uses `evaluateGenerateGate` so users see exhausted quotas or “needs advanced” before reserve when possible.

Daily limits differ by `profiles.plan` and tier. Detail: `docs/billing-usage.md`.

---

# 8. Summary language

* **App UI** remains English (`next-intl` / `messages/en.json`).
* **Summary output** language is user-chosen from a supported ISO 639-1 list (onboarding, account prefs, and per-Generate control).
* Worker prefers a caption track in that language; otherwise uses the video’s primary caption language.
* If transcript language ≠ output language, the LLM **translates faithfully** while generating.
* Missing captions in both preferred and primary → clear workspace error. No Whisper.

Topic-scoped EAV and video-specific free-text prefs remain **out of scope**.

---

# 9. YouTube Input

YouTube URL only. No uploads. No Whisper.

---

# 10. Transcript

Primary source for AI analysis. Timestamped segments required for synced sections.

```text
Preview: metadata only (no transcript required)
Generate / worker: fetch timestamped captions (preferred summary lang → primary)
```

`youtubei.js` behind `TranscriptProvider`. Optional `YOUTUBE_PROXY_URL`.

---

# 11. Video Analysis Pipeline

Independent from UI. Not implemented inside React or Server Actions.

```text
Home Preview (no DB)
  → metadata only
Home Generate
  → reserve usage_events (run_id, tier)
  → upsert user_videos + analysis prefs + run_id
  → enqueue analyze
  → redirect workspace
Worker
  → fetching (captions + refresh metadata)
  → generating (overview + section bodies in summary_language)
  → complete | failed
```

Detail: `docs/analysis-pipeline.md`.

---

# 12. (Removed) Classification

There is **no** classify LLM stage. Do not call `classifyVideo`. Do not persist `isEducational` / topic classification for product behavior.

---

# 13. Per-video prefs UI

Product-owned home panel (not an LLM stage), after Preview, before Generate.

---

# 14. Personalized sections (only AI stage)

Input:

```text
Video metadata
+
Transcript subset (tier-budgeted)
+
Per-video prefs (length, tone, familiarity if set)
+
Output language (summary_language)
```

Output:

```text
{ summary, sections: { title, startTime, endTime, body }[] }
```

Short videos may have a single section. Do not invent facts absent from the transcript.

---

# 15. Personalized Does Not Mean "Rewrite Everything"

Personalization affects emphasis, depth, tone/formality, language, and what can be skipped. It must stay faithful to the source. High familiarity → less re-explaining basics; it must not invent claims.

---

# 16. Video Workspace

The video workspace (`/v/[userVideoId]`) is the most important UI screen.

Desktop concept:

```text
┌─────────────────────────────────────────────────────────────┐
│ Back · Title / channel · status · theme                     │
├───────────────────────────────┬─────────────────────────────┤
│ VIDEO (player)                │ Overview summary            │
│                               │                             │
├───────────────────────────────┤                             │
│ Sections (highlight + seek)   │                             │
│                               │                             │
└───────────────────────────────┴─────────────────────────────┘
```

Mobile stacks player above sections; seeking a section scrolls the player into view. Exact chrome lives in `WorkspaceShell`.

There is no non-edu disclaimer; generate always produces an overview summary and sections from the transcript and prefs.

The most important interaction is synchronization.

---

# 17. Synchronized Sections

Each generated section has:

```text
title
startTime
endTime
body
```

The video player exposes `currentTime`.

The frontend determines the active section:

```text
currentTime >= startTime
AND
currentTime < endTime
```

The active section should:

* visually highlight
* optionally scroll into view
* remain synchronized as the video plays

Clicking a section should seek the video to its `startTime`.

This synchronization should be handled on the client.

Do not make AI calls during video playback.

AI prepares the structured information ahead of time; the frontend handles synchronization.

(Older docs may say "chapters"; product language is **sections**.)

---

# 18. Home / library

Home is the user’s collection plus the paste/Preview/Generate composer.

Functionality:

* list analyzed videos (active rows; soft-deleted hidden)
* **Preview** a YouTube URL (metadata + prefs under the input; no row yet)
* **Generate** (usage + row + enqueue + redirect to workspace)
* video processing states
* open a video
* optionally remove a video (soft-delete; re-add inserts a new row)

Do not build advanced search, recommendations, knowledge graphs, or cross-video intelligence.

---

# 19. Database concepts

All video data is **per-user**. There is **no** shared cross-user cache of metadata or transcripts.

```text
profiles                 # tone, length, default_summary_language, plan, Stripe ids
user_videos              # one active row per (user_id, youtube_id); metadata + transcript; soft-delete
personalized_analyses    # 1:1 with user_videos: state, prefs, model_tier, summary_language, summary, sections
usage_events             # one row per Generate reservation (run_id); refunds set refunded_at
```

Conceptually:

```text
User
├── profile (defaults + plan)
└── User × Video
    ├── user_videos (metadata + transcript; re-Generate refreshes this user’s row)
    └── personalized_analyses
        ├── status + run_id
        ├── prefs (length, tone, familiarity?, summary_language, model_tier)
        ├── overview summary
        └── generated sections { title, startTime, endTime, body }
```

Do **not** use open key/value `user_context` / topic EAV / video-specific free-text prefs.

Implement with Drizzle; enforce RLS on all user-owned tables.

---

# 20. Supabase

Supabase provides:

* authentication (including anonymous guests)
* PostgreSQL
* persistent application data

RLS should protect user-owned records.

Never trust a `user_id` supplied by the browser.

Server-side authentication should determine the current user.

RLS is an additional database-level authorization boundary, not a replacement for application-level authorization.

---

# 21. RLS Philosophy

Tables containing user-owned data should generally have RLS policies based on the authenticated user's ID.

Similar ownership rules should apply to:

* profiles
* user_videos
* personalized analyses
* usage_events
* notes, if notes are added later

Do not disable RLS merely to make development easier.

---

# 22. Next.js

Use current stable Next.js and React versions with the App Router and a **`src/`** layout.

Next.js is responsible for:

* application UI
* routing
* Server Components
* Server Actions
* authentication integration
* server-side application logic (thin — domain owns business rules)

TanStack Query is used on the client for mutations and analysis-status polling; primary reads stay in Server Components.

Server Actions are preferred for application mutations.

Examples:

```text
previewYoutube()      # metadata only; no DB; no usage
generateVideo()       # reserve usage + upsert row + enqueue + redirect target
updateProfile()       # tone / length / default summary language
deleteVideo()         # soft-delete
createCheckout…()     # Stripe Checkout / Portal entry points
```

The analysis pipeline itself should live outside the Server Action.

The Server Action should authenticate/authorize the request, validate input, and invoke the appropriate application logic.

Stripe webhook is a Route Handler (`/api/stripe/webhook`), not a Server Action.

---

# 23. Server Actions

Use Server Actions rather than introducing tRPC.

There is no requirement for a public API.

Do not create REST endpoints or tRPC procedures unless a concrete requirement appears (Stripe webhook is the intentional exception).

Keep Server Actions thin.

Conceptually:

```text
Server Action
  ↓
validate input
  ↓
authenticate user
  ↓
authorize
  ↓
call domain/application function
  ↓
return result
```

Business logic should not become embedded inside Server Actions.

---

# 24. AI Provider

Use the **Vercel AI SDK** behind an application-level `AIProvider` abstraction so the model can change later.

Model ids live in `analysisConfig` (OpenRouter), keyed by tier. Do not put model ids in env (secret: `OPENROUTER_API_KEY` only).

Conceptually:

```text
AIProvider
└── generateSections()   # { summary, sections: { title, startTime, endTime, body }[] }
```

Per-video prefs and language are product-owned UI, not AIProvider methods. No `classifyVideo`.

Do not scatter vendor SDK calls outside the provider module.

---

# 25. LLM Output

LLM output must be structured and validated with Zod before persist.

```text
LLM → structured output → Zod validation → application types → database
```

Schemas should explicitly define:

* overview `summary`
* section titles
* section timestamps (`startTime`, `endTime`)
* section bodies

Do not schema LLM-invented knowledge questions or classify outputs.

---

# 26. Cost Awareness

LLM calls are a significant part of the application's cost.

Important principles:

* Preview never calls the LLM
* generate is one transcript-shaped call after Generate
* cap `maxOutputTokens` per tier in `analysisConfig`
* budget transcript chars per tier
* keep prompts focused
* model ids live in `analysisConfig`, not env
* reserve/refund usage so failed starts do not consume a slot

---

# 27. Redis

Redis is used for:

* BullMQ analysis queue
* Per-video analysis lock (SET NX + heartbeat; prevents duplicate LLM work)

Usage metering is Postgres (`usage_events`). `run_id` CAS still guards analysis writes.

Do **not** cache transcripts or summaries in Redis.

---

# 28. Background Processing

A BullMQ worker (Railway) runs `continueAnalysis` (one stage per tick) until complete/failed.

```text
Server Action (generateVideo)
    ↓
enqueue analyze job
    ↓
Worker loop → continueAnalysis
```

Domain pipeline stays independent of the transport.

---

# 29. Analysis State

States:

```text
pending
fetching
generating
complete
failed
```

No `classifying` or `awaiting`. Prefs are collected before Generate on home.

The UI should clearly communicate processing state without exposing Redis, BullMQ, or `runId`.

---

# 30. Billing & usage

Entitlement and metering are separate:

| Concern | Source of truth |
|---------|-----------------|
| Plan (`free` \| `pro`) | `profiles.plan`, updated by Stripe webhooks |
| Generate slots | Postgres `usage_events` (reserve / soft refund) |

* Checkout success URLs **never** write plan
* Pro is **$10/month**
* `past_due` keeps Pro during dunning until Stripe cancels / unpaid
* Limits live in `analysisConfig` (user daily per tier; global hourly/daily; optional IP daily for guest abuse)

Reserve happens before ingest/enqueue; failures refund the same `run_id`. Re-Generate refunds the prior in-flight reservation for that video.

Detail: `docs/billing-usage.md`. Account → Usage surfaces plan comparison, upgrade, and portal.

---

# 31. Product scope (shipped)

### App shell

* home composer + library list
* guest session on first visit
* responsive design; system theme default

### Authentication

* anonymous guests
* sign up / login / logout
* guest convert (email/password + Google link) preserving `user.id`
* soft email confirmation

### Onboarding

* optional default summary language, tone, length (skip → sensible defaults)
* hidden for guests

### Home

* Preview YouTube URL (metadata + prefs; no row)
* Generate (usage + row + enqueue + redirect workspace)
* list / open / soft-delete videos
* processing states

### Video ingestion

* YouTube URL validation
* metadata preview (no DB)
* on Generate: upsert row; worker fetches captions
* YouTube category id for familiarity gating

### AI

* generate only: overview `summary` + section **bodies**
* output in chosen `summary_language` (translate if needed)
* no classify stage; no LLM-invented questions

### Profile + per-video prefs

* typed profile defaults: language + tone + length + plan
* per-video length, tone, language, model tier; familiarity when category qualifies

### Video workspace

* YouTube player + synchronized sections + overview summary

### Billing

* Stripe Checkout + Customer Portal + webhooks
* Postgres usage metering with refunds

### Infra

* Vercel web app; Railway Redis + analysis worker

---

# 32. Explicitly out of scope

Do not implement these unless the scope is deliberately changed:

* AI chat / conversational assistant
* uploaded video files / Whisper / arbitrary video sites
* knowledge graph, cross-video semantic search, recommendations
* personalized learning paths, quizzes, spaced repetition
* social features, sharing, collaborative notes
* complex notification system
* PostHog / product analytics
* tRPC / Prisma
* non-English **app UI** (summary **output** language is already shipped)
* Playwright / E2E
* LLM-invented knowledge questions
* topic / video EAV context
* shared cross-user transcript cache
* AI classify / isEducational / non-edu disclaimer
* educational profile fields (YOB, education level, subjects)

---

# 33. Future Product Direction

After the core experience works, possible extensions include:

## Cross-video knowledge

Search and ask across a user’s library.

## Related videos / learning paths

Concepts shared across videos; structured sequences.

## Saved insights

Timestamp + insight bookmarks.

## Search

Across transcripts and summaries.

## Chat

Conversational interaction — deliberately excluded for now.

## App locales

German (and other) **UI** strings via next-intl.

---

# 34. UX Principles

The application should feel:

* fast
* calm
* focused
* content-first
* intelligent without being noisy
* useful without requiring configuration

Avoid:

* excessive AI branding
* giant chatbot interfaces
* unnecessary dashboards
* too many settings
* excessive animations
* generic SaaS card grids
* unnecessary onboarding questions

The product should progressively reveal complexity.

The user should be able to go from:

```text
"I have a YouTube link"
```

to:

```text
"I have a useful personalized summary"
```

with minimal friction — including as a guest.

---

# 35. Design Direction

The visual language should be:

* editorial
* premium
* modern
* restrained
* typography-driven
* content-focused

Brand name **VideoBrief** should read as a hero-level signal on any marketing surfaces.

Typography:

* Display / brand: **Nunito**
* UI / body: **Nunito**

Theme: **system** default via next-themes (users may switch).

i18n: English **app UI** only (`next-intl` scaffolded for future locales). Summary **output** language is selectable.

The video workspace should feel closer to a high-quality reading/knowledge application than a traditional SaaS admin dashboard.

The summary should feel like a document that happens to be synchronized with a video.

The UI should make the relationship between:

```text
video ↔ section ↔ explanation
```

immediately obvious.

---

# 36. Core Product Principle

The central product loop is:

```text
USER
  │
  │ YouTube URL → Preview (metadata) → prefs on home
  ▼
GENERATE
  │
  ├── Reserve usage (tier)
  ├── Upsert user_videos + analysis (prefs, language, run_id)
  └── Enqueue analyze → redirect /v/[id]
  ▼
WORKER
  │
  ├── Fetch captions (preferred lang → primary)
  └── generateSections → { summary, sections[] } in summary_language
  ▼
VIDEO WORKSPACE
  │
  └── Highlight active section; click seeks
```

This loop is the heart of the application.

Any new feature should be evaluated against whether it improves this experience.

---

# 37. Architectural Principle

Prefer the simplest architecture that correctly solves the problem.

Current architecture:

```text
Browser
   ↓
Next.js on Vercel (src/app)
   ├── Server Components
   ├── Server Actions (thin: validate, reserve, persist, enqueue)
   ├── TanStack Query (home / workspace status polling)
   └── domain/application logic
          │
          ├── Drizzle → Supabase Postgres (+ RLS)
          └── enqueue BullMQ analyze job (Redis on Railway)
Worker on Railway
   └── loop continueAnalysis (fetch → generate)
          ├── TranscriptProvider (youtubei.js)
          └── AIProvider (Vercel AI SDK; model from analysisConfig by tier)
```

Do not add infrastructure because it is available.

In particular:

* no tRPC without a concrete API requirement
* Redis/BullMQ for the analysis queue + per-video lock (not a transcript cache; usage is Postgres)
* Worker owns fetch/generate; Next does not run the pipeline
* no Prisma (Drizzle is locked)
* no abstraction without a reason
* no feature without a product purpose

---

# 38. Definition of Done

A user should be able to:

1. Land on home as a guest (anonymous session) or signed-in user.
2. After convert, complete optional onboarding (language / tone / length) or skip.
3. Preview a YouTube URL (metadata + prefs; no library row yet).
4. Set length, tone, optional familiarity, summary language, and model tier.
5. Generate → usage reserved → redirect to workspace while the job runs.
6. See fetch / generate progress (failures surface on the workspace).
7. Receive personalized overview + section **bodies** in the chosen language.
8. Watch the video with active section highlight and click-to-seek.
9. Return to home and find the analyzed video; open it again later.
10. Upgrade to Pro via Stripe and see higher daily limits reflected in Account → Usage.
11. Convert guest → account without losing library rows or usage history.

If all of this works reliably, the product loop is successful.

---

# 39. Guiding Question

Whenever making an architectural or product decision, ask:

> **Does this help turn a YouTube video into a better personalized understanding for this user?**

If not, it probably belongs outside the current ship.
