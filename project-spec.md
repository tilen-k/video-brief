# VideoBrief — Project Spec

Brand: **VideoBrief** · Domain: **videobrief.app**

Canonical agent rules live in `.cursor/rules/`. Short overview: `project-context.md`.

## 1. Project Overview

We are building a **contextual YouTube summarizer**: personalized, interactive section summaries synchronized with playback.

The core product idea is:

> **Paste a YouTube URL. Preview metadata and set summary prefs in the library. Generate a personalized sectioned summary and watch it synced with the video.**

Not a chatbot. Not education-first tooling. Personalization comes from **per-video length, tone, and (when category qualifies) familiarity** — plus optional profile defaults.

A user should be able to use the application with almost no configuration:

1. Sign up.
2. Optional onboarding: default summary **tone** and **length** (skip → 50 / 50).
3. On the library: paste a YouTube URL and **Preview** (metadata only — title, thumb, channel, duration, category). **No** library row, **no** usage yet.
4. Under the input: summary settings — length and tone always; familiarity only for qualifying YouTube categories.
5. **Generate** → create `user_videos` + analysis, count usage, enqueue worker, **redirect to workspace** (job continues if they leave).
6. Worker fetches English transcript → generates `{ summary, sections[] }`.
7. User watches with synchronized section highlight and seek.

**Familiarity categories** (YouTube category id map; may extend later): Education, Howto & Style, Science & Technology, News & Politics.

There is **no** AI classify stage and **no** non-edu disclaimer.

---

# 2. Product Philosophy

The application should feel like a **personalized video understanding tool**, not an AI chatbot.

Primary interaction: **Watch → understand → remember**

AI stays largely invisible in the workspace. Prefer useful sections and summaries over chat.

MVP does one thing well:

> **Turn a YouTube video into a contextual, synchronized section summary shaped by length, tone, and optional familiarity.**

---

# 3. Core User Flow

## 3.1 Landing Page

Explains the product; clear CTA to sign up. Editorial, premium, content-first, typography-focused — not overly "AI-looking."

## 3.2 Authentication

```text
Landing → Sign up / Log in → Onboarding → Library
```

Supabase Auth: email/password, Google OAuth, soft email confirmation.

---

# 3.3 Technology Stack (Locked)

Do not substitute these without an explicit product decision.

### Application

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router, React, TypeScript (`src/` layout) |
| Package manager | pnpm |
| Hosting | Vercel |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| Forms | React Hook Form + Zod |
| Client data | TanStack Query (mutations + analysis-status polling; RSC for primary reads) |
| Theme | next-themes, **dark default** |
| i18n | next-intl, **English only** for this ship (German app UI later) |
| Fonts | **Nunito** (display/brand and UI/body) |

### Data & auth

| Layer | Choice |
|-------|--------|
| Auth | Supabase Auth (email/password + Google) |
| Database | Supabase PostgreSQL |
| ORM / migrations | Drizzle ORM + Drizzle Kit |
| Session | `@supabase/ssr` |
| Authorization | App checks + Postgres RLS |

### AI

| Layer | Choice |
|-------|--------|
| SDK | Vercel AI SDK behind `AIProvider` abstraction |
| Default model | `analysisConfig` (OpenRouter) |
| Output | Structured + Zod-validated before persist |

### YouTube

| Layer | Choice |
|-------|--------|
| Transcript / metadata | `youtubei.js` behind `TranscriptProvider` |
| Captions | **English only** for this ship; missing English transcript → clear error |
| Player | `react-youtube` (IFrame API for seek/time sync) |
| Prod fetch risk | Optional `YOUTUBE_PROXY_URL` for Innertube/captions when Vercel IPs are blocked |

### Queue & usage

| Layer | Choice |
|-------|--------|
| Redis | BullMQ analysis queue + per-video lock + monthly Generate counters |
| Worker | BullMQ analysis runner (separate process) |

### Testing

| Layer | Choice |
|-------|--------|
| Unit | Vitest (+ Testing Library as needed) |
| E2E | Out of scope for MVP |

### Explicitly not in this ship

Prisma, tRPC, PostHog/analytics, Stripe, Jest, Playwright, Whisper/audio transcription, app DE / summary-language picker / non-EN transcripts, AI classify.

### Recommended MCP (Cursor)

* Supabase MCP (prefer read-only) for schema/RLS inspection
* Humans test UI in the browser; agents do not use cursor-ide-browser unless asked.

---

# 4. Onboarding

Lightweight. All fields optional; skip allowed → defaults **tone 50**, **length 50**.

| Field | Storage / behavior |
|-------|--------------------|
| Default summary tone | Integer 0–100 (Formal ←→ Casual) |
| Default summary length | Integer 0–100 (Short ←→ Long) |

Persist as typed profile columns: `summary_tone`, `summary_length`.

**Removed from product:** year of birth, education level, subjects, `summary_style` enum.

---

# 5. Two kinds of context

## 5.1 Profile (stable defaults)

```text
summary_tone      # 0–100, default 50
summary_length    # 0–100, default 50
plan              # free | pro
```

## 5.2 Per-video prefs

Collected in the **library preview panel** before Generate; stored on the analysis row:

```text
summary_length    # 0–100 — always
summary_tone      # 0–100 — always
familiarity       # 0–100 or null — only when category qualifies
```

Slider labels: length Short←→Long; tone Formal←→Casual; familiarity topic familiarity (Novice←→Expert or equivalent).

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

# 7. Context persistence

Profile defaults may be edited in settings later.

Per-video prefs persist on `personalized_analyses`. Re-Generate / same URL again **resets** analysis (`run_id`, clears summary/sections) and may overwrite prefs.

---

# 8. (Reserved)

Topic-scoped EAV and video-specific free-text prefs are **out of MVP**.

---

# 9. YouTube Input

YouTube URL only. No uploads. No Whisper.

---

# 10. Transcript

Primary source for AI analysis. Timestamped segments required for synced sections.

```text
Preview: metadata only (no transcript required)
Generate / worker: fetch English timestamped transcript
```

If English captions cannot be obtained after Generate, fail clearly on the workspace. Do not fall back to other languages or Whisper in this ship.

`youtubei.js` behind `TranscriptProvider`. Optional `YOUTUBE_PROXY_URL`.

---

# 11. Video Analysis Pipeline

Independent from UI. Not implemented inside React or Server Actions.

```text
Library Preview (no DB)
  → metadata only
Library Generate
  → usage slot + upsert user_videos + analysis prefs + run_id
  → enqueue analyze
  → redirect workspace
Worker
  → fetching (transcript + refresh metadata)
  → generating (overview + section bodies)
  → complete | failed
```

---

# 12. (Removed) Classification

There is **no** classify LLM stage. Do not call `classifyVideo`. Do not persist `isEducational` / topic classification for product behavior.

---

# 13. Per-video prefs UI

Product-owned library panel (not an LLM stage), after Preview, before Generate.

---

# 14. Personalized sections (only AI stage)

Input:

```text
Video metadata
+
Transcript subset
+
Per-video prefs (length, tone, familiarity if set)
```

Output:

```text
{ summary, sections: { title, startTime, endTime, body }[] }
```

Short videos may have a single section. Do not invent facts absent from the transcript.

---

# 15. Personalized Does Not Mean "Rewrite Everything"

Personalization affects emphasis, depth, tone/formality, and what can be skipped. It must stay faithful to the source. High familiarity → less re-explaining basics; it must not invent claims.

---

# 16. Video Workspace

The video workspace is the most important UI screen.

Conceptually:

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       VIDEO                                 │
│                                                             │
│                         ▶                                   │
│                                                             │
├───────────────────────────────────────┬─────────────────────┤
│                                       │                     │
│ Transcript / controls                 │ Sections            │
│                                       │                     │
│                                       │ 01 Introduction     │
│                                       │                     │
│                                       │ Body...             │
│                                       │                     │
│                                       │ 02 Core Concept     │
│                                       │                     │
│                                       │ Body...             │
│                                       │                     │
└───────────────────────────────────────┴─────────────────────┘
```

The exact visual design will be developed in Figma.

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

# 18. Library

The library is the user's collection of analyzed videos.

MVP functionality:

* view videos
* see processing status
* open a video
* **Preview** a YouTube URL (metadata + prefs under the input; no row yet)
* **Generate** (create row, usage, enqueue, redirect to workspace)
* optionally remove a video

Do not build advanced search, recommendations, knowledge graphs, or cross-video intelligence in the MVP.

---

# 19. Suggested Database Concepts

All video data is **per-user**. There is **no** shared cross-user cache of metadata or transcripts.

```text
profiles                 # typed: summary_tone, summary_length, plan
user_videos              # one row per (user_id, youtube_id); metadata + EN transcript snapshot
personalized_analyses    # 1:1 with user_videos: state, prefs, summary, sections
```

Conceptually:

```text
User
├── profile (default tone + length)
└── User × Video
    ├── user_videos (metadata + transcript; re-Generate refreshes this user's row)
    └── personalized_analyses
        ├── status
        ├── per-video prefs (summary_length, summary_tone, familiarity?)
        ├── overview summary
        └── generated sections { title, startTime, endTime, body }
```

Do **not** use open key/value `user_context` / topic EAV / video-specific free-text prefs in MVP.

The exact schema should avoid unnecessary duplication. Implement with Drizzle; enforce RLS on all user-owned tables.

---

# 20. Supabase

Supabase provides:

* authentication
* PostgreSQL
* persistent application data

RLS should protect user-owned records.

The database should enforce that users can only access their own private application data.

Never trust a `user_id` supplied by the browser.

Server-side authentication should determine the current user.

RLS is an additional database-level authorization boundary, not a replacement for application-level authorization.

---

# 21. RLS Philosophy

Tables containing user-owned data should generally have RLS policies based on the authenticated user's ID.

For example:

```text
videos.user_id = authenticated_user.id
```

Similar ownership rules should apply to:

* profiles
* user_videos
* personalized analyses
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
* server-side application logic

TanStack Query is used on the client for mutations and analysis-status polling; primary reads stay in Server Components.

Server Actions are preferred for application mutations.

Examples:

```text
previewYoutube()      # metadata only; no DB; no usage
generateVideo()       # usage + upsert row + enqueue + redirect target
updateProfile()       # tone / length defaults
deleteVideo()
```

The analysis pipeline itself should live outside the Server Action.

The Server Action should authenticate/authorize the request, validate input, and invoke the appropriate application logic.

---

# 23. Server Actions

Use Server Actions rather than introducing tRPC for the MVP.

There is no requirement for a public API.

Do not create REST endpoints or tRPC procedures unless a concrete requirement appears.

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

MVP default model lives in `analysisConfig` (OpenRouter). Do not put the model id in env.

Conceptually:

```text
AIProvider
└── generateSections()   # { summary, sections: { title, startTime, endTime, body }[] }
```

Per-video prefs are product-owned UI, not an AIProvider method. No `classifyVideo`.

Do not scatter vendor SDK calls outside the provider module.

---

# 25. LLM Output

LLM output must be structured and validated.

Use a schema validation library such as Zod.

Conceptually:

```text
LLM
 ↓
structured output
 ↓
Zod validation
 ↓
application types
 ↓
database
```

Never blindly trust raw LLM output before writing it to the database.

Schemas should explicitly define:

* overview `summary`
* section titles
* section timestamps (`startTime`, `endTime`)
* section bodies

Do not schema LLM-invented knowledge questions or classify outputs.

---

# 26. Cost Awareness

LLM calls are a significant part of the application's cost.

Design the pipeline to avoid unnecessary calls.

Important principles:

* Preview never calls the LLM
* generate is one transcript-shaped call after Generate
* cap `maxOutputTokens` on generate
* do not send the same large transcript twice
* keep prompts focused
* model id lives in `analysisConfig`, not env

---

# 27. Redis

Redis is used for:

* BullMQ analysis queue
* per-video analysis lock
* monthly per-user **Generate** usage counters

Do **not** cache transcripts or summaries in Redis.

---

# 28. Background Processing

A BullMQ worker runs `continueAnalysis` (one stage per tick) until complete/failed.

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

Video analysis can be represented with explicit states.

States:

```text
pending
fetching
generating
complete
failed
```

No `classifying` or `awaiting`. Prefs are collected before Generate in the library UI.

The UI should clearly communicate processing state.

Example:

```text
✓ Video found
✓ Transcript loaded
✓ Video analyzed
● Generating personalized summary
```

Do not expose unnecessary implementation details to users.

---

# 30. MVP Scope

The MVP includes:

### Marketing

* landing page
* product explanation
* CTA
* responsive design

### Authentication

* sign up
* login
* logout

### Onboarding

* optional default summary tone (0–100; Formal←→Casual); skip → 50
* optional default summary length (0–100; Short←→Long); skip → 50

### Library

* list analyzed videos
* Preview YouTube URL (metadata + prefs; no row)
* Generate (usage + row + enqueue + redirect workspace)
* video processing states
* open video
* delete video

### Video ingestion

* YouTube URL validation
* metadata preview (no DB)
* on Generate: upsert row; worker fetches English transcript
* YouTube category id for familiarity gating

### AI

* generate only: overview `summary` + section **bodies** `{ title, startTime, endTime, body }`
* no classify stage; no LLM-invented questions

### Profile + per-video prefs

* typed profile defaults: tone + length
* per-video length + tone always; familiarity when category qualifies
* answers persist on the analysis row

### Video workspace

* YouTube video player
* synchronized sections (highlight + seek)
* overview summary + section bodies

---

# 31. Explicitly Out of Scope for MVP

Do not implement these unless the scope is deliberately changed:

* AI chat
* conversational assistant
* uploaded video files
* audio transcription
* arbitrary video websites
* knowledge graph
* cross-video semantic search
* recommendations
* personalized learning paths
* quizzes
* spaced repetition
* social features
* sharing
* collaborative notes
* background worker infrastructure
* Redis
* tRPC
* complex notification system
* PostHog / product analytics
* Stripe / billing
* non-English UI or non-English captions (**next ship:** app DE, summary language, default-transcript language)
* Playwright / E2E (unit tests only in MVP)
* LLM-invented knowledge questions
* topic / video EAV context
* shared cross-user transcript cache
* AI classify / isEducational / non-edu disclaimer
* educational profile fields (YOB, education level, subjects)

These are potential future features, not MVP requirements.

---

# 32. Future Product Direction

After the core experience works, possible extensions include:

## Cross-video knowledge

Search and ask:

> What have I learned about Redis?

## Related videos

Identify concepts shared across videos.

## Personal knowledge profile

Show:

```text
React
█████████░ Advanced

AI
██████░░░░ Intermediate

Kubernetes
██░░░░░░░░ Beginner
```

## Learning paths

Turn a collection of videos into a structured learning sequence.

## Saved insights

Allow users to save a timestamp + insight.

## Search

Search across transcripts and summaries.

## Chat

Potentially add conversational interaction later, but this is deliberately excluded from the MVP.

---

# 33. UX Principles

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

with minimal friction.

---

# 34. Design Direction

The visual language should be:

* editorial
* premium
* modern
* restrained
* typography-driven
* content-focused

Brand name **VideoBrief** should read as a hero-level signal on marketing surfaces.

Typography:

* Display / brand: **Nunito**
* UI / body: **Nunito**

Theme: **dark default** via next-themes (users may switch; respect system after first choice when appropriate).

i18n: English UI only for MVP (`next-intl` scaffolded for future locales).

The video workspace should feel closer to a high-quality reading/knowledge application than a traditional SaaS admin dashboard.

The summary should feel like a document that happens to be synchronized with a video.

The UI should make the relationship between:

```text
video ↔ section ↔ explanation
```

immediately obvious.

---

# 35. Core Product Principle

The central product loop is:

```text
USER
  │
  │ YouTube URL → stub + workspace
  ▼
FETCH + CLASSIFY
  │
  ├── Metadata + English transcript
  ├── Is this educational?
  └── Topic? (for familiarity wording)
  │
  ▼
PER-VIDEO PREFS (optional, skippable)
  │
  ├── Familiarity (edu + topic known)
  └── Length (default from profile summary_style)
  │
  ▼
GENERATE SECTIONS
  │
  └── { title, startTime, endTime, body }[]
  │
  ▼
VIDEO WORKSPACE
  │
  └── Highlight active section; click seeks
```

This loop is the heart of the application.

Any new feature should be evaluated against whether it improves this experience.

---

# 36. Architectural Principle

Prefer the simplest architecture that correctly solves the problem.

Current intended architecture:

```text
Browser
   ↓
Next.js (src/app)
   ├── Server Components
   ├── Server Actions (thin: validate, persist stub, enqueue)
   ├── TanStack Query (library / workspace status polling)
   └── domain/application logic
          │
          ├── Drizzle → Supabase Postgres (+ RLS)
          └── enqueue BullMQ analyze job (Redis)
Worker
   └── loop continueAnalysis (fetch → generate)
          ├── TranscriptProvider (youtubei.js)
          └── AIProvider (Vercel AI SDK; model from analysisConfig)
```

Do not add infrastructure because it is available.

In particular:

* no tRPC without a concrete API requirement
* Redis/BullMQ for the analysis queue and per-video lock only (not a transcript cache)
* Worker owns fetch/generate; Next does not run the pipeline
* no Prisma (Drizzle is locked)
* no abstraction without a reason
* no feature without a product purpose

The architecture should be allowed to evolve when the actual application exposes real constraints.

---

# 37. Development Priorities

Build in this order:

1. Project setup
2. Supabase authentication
3. Database schema + RLS (typed profile; prefs on analysis)
4. Basic educational onboarding (YOB, education level, subjects, optional summary style)
5. Library UI
6. YouTube stub + stay on library (enqueue analysis)
7. Transcript / metadata fetch in the analysis worker
8. Classification (`isEducational` + topic)
9. Fixed per-video prefs (familiarity + length; skip allowed)
10. Personalized section **bodies**
11. Timestamp synchronization (section highlight + seek)
12. Soft non-edu disclaimer + error/loading states
13. Unit tests (Vitest) for schemas and domain helpers
14. Visual polish
15. Responsive/mobile behavior

Do not begin by implementing every possible AI feature.

The most important milestone is:

> A user can preview a YouTube URL, set length/tone/(optional) familiarity, Generate, and receive personalized section **bodies** synchronized with that video.

---

# 38. Definition of Done for the MVP

A user should be able to:

1. Visit the landing page.
2. Create an account.
3. Complete lightweight educational onboarding (or skip).
4. Enter a YouTube URL and land on the workspace immediately.
5. See fetch / generate progress in the workspace (failures surface there).
6. If educational and a topic is known: optional familiarity select; skip allowed.
7. Optional length select (default from `summary_style` or moderate); skip allowed.
8. If not educational: see a soft disclaimer and no familiarity question.
9. Have per-video prefs persisted on the analysis row when provided.
10. Receive personalized section **bodies** (profile used when present).
11. Watch the video.
12. See the relevant section highlighted as the video progresses.
13. Click a section and jump to that point in the video.
14. Return to the library and find the analyzed video.
15. Open the video again later with its saved analysis.

If all of this works reliably, the MVP is successful.

---

# 39. Guiding Question

Whenever making an architectural or product decision, ask:

> **Does this help turn a user's YouTube video into a better personalized understanding of that video — especially for learning?**

If not, it probably belongs outside the MVP.
