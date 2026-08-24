# VideoBrief — Project Spec

Brand: **VideoBrief** · Domain: **videobrief.app**

Canonical agent rules live in `.cursor/rules/`. Short overview: `project-context.md`.

## 1. Project Overview

We are building an **education-first** web application that turns YouTube videos into **personalized, interactive section summaries** synchronized with playback.

The core product idea is:

> **Paste a YouTube video. The application classifies whether it is educational, optionally collects a couple of per-video summary prefs, and generates personalized section explanations synchronized with the video.**

The application is intentionally **not** a generic "AI YouTube summarizer."

The differentiating feature is **personalization through a stable educational profile plus per-video familiarity and length prefs**.

A user should be able to use the application with almost no configuration:

1. Sign up.
2. Complete lightweight educational onboarding (all fields optional).
3. Paste a YouTube URL and land on the workspace immediately.
4. The application fetches metadata + English transcript and **classifies** the video (`isEducational` + topic).
5. If educational and a topic is known: optional familiarity select (3 levels).
6. Optional summary length select (3 levels; default from profile `summary_style` or moderate). Skip always allowed.
7. If not educational: soft disclaimer; **no** familiarity question; still produce a sectioned summary using profile when present.
8. Per-video answers persist on the analysis row (not the profile).
9. The application generates personalized **section bodies** `{ title, startTime, endTime, body }`.
10. The user watches with synchronized section highlight and seek.

**Primary fit:** educational content (lectures, course chapters, explainers, technical tutorials intended for learning).

**Also allowed:** any other YouTube video with English captions — summarized into sections with a soft disclaimer that learning personalization may not apply the same way.

Classification is an LLM structured stage (Zod-validated). YouTube `categoryId` may be passed as a **hint**, not the sole decision. If classification confidence is ambiguous, **prefer educational**.

---

# 2. Product Philosophy

The application should feel like a **personalized video knowledge tool**, not an AI chatbot.

The primary interaction is:

> **Watch → understand → remember**

The AI should be largely invisible in the final interface. The user should primarily see useful information, **sections**, summaries, and context-aware explanations rather than a chat interface.

The product should be simple enough that the main workflow is immediately understandable.

Avoid feature creep.

The MVP should do one thing exceptionally well:

> **Turn an educational YouTube video into a level-aware, synchronized section summary — and still summarize everything else with a soft caveat.**

---

# 3. Core User Flow

## 3.1 Landing Page

The landing page explains the product and has a clear CTA to sign up.

The visual direction is:

* editorial
* premium
* content-first
* restrained
* typography-focused
* clean
* modern
* not overly "AI-looking"

The video workspace should be the visual centerpiece of the product.

Do not make the landing page overly complex.

---

## 3.2 Authentication

Users must authenticate before adding videos.

Expected flow:

```text
Landing
  ↓
Sign up / Log in
  ↓
Onboarding
  ↓
Library
```

Authentication is handled with Supabase Auth:

* email / password
* Google OAuth (personal Google Cloud project)
* soft email confirmation (users can use the app before verifying; nudge later)

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
| i18n | next-intl, **English only** for MVP |
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
| Captions | **English only**; missing English transcript → clear error |
| Player | `react-youtube` (IFrame API for seek/time sync) |
| Prod fetch risk | Vercel IPs may be blocked; ship without proxy first; keep provider swappable for proxy/worker later |

### Testing

| Layer | Choice |
|-------|--------|
| Unit | Vitest (+ Testing Library as needed) |
| E2E | Out of scope for MVP |

### Explicitly not in MVP

Prisma, tRPC, Redis, background workers, PostHog/analytics, Stripe, Jest, Playwright, Whisper/audio transcription.

### Recommended MCP (Cursor)

* Supabase MCP (prefer read-only) for schema/RLS inspection
* Do not rely on Prisma MCP. Humans test UI in the browser; agents do not use cursor-ide-browser unless asked.

---

# 4. Onboarding

Onboarding should collect a **lightweight educational baseline**. All fields are optional; skip is allowed.

Do not make onboarding a long questionnaire.

| Field | Storage / behavior |
|-------|--------------------|
| Year of birth | User enters a number; store as `yyyy`. Used for **framing** only (not gating or age gates). |
| Education level | Enum (single select): `middle_school`, `high_school`, `undergrad`, `grad`, `bootcamp`, `self_taught`, `other` |
| Subjects of interest | Multi-select chips from a fixed list; **`other` is the last chip** (no free-text for Other in MVP) |
| Summary style | Optional global default for length: `brief` / `moderate` / `extensive`. Settings later if not collected here. |

Suggested subject chips (define as a shared const/enum in code):

`math`, `physics`, `chemistry`, `biology`, `computer_science`, `engineering`, `economics`, `history`, `languages`, `other`

Persist these as **typed profile fields** (not open key/value): `year_of_birth`, `education_level`, `subjects`. Optional `summary_style` (`brief` / `moderate` / `extensive`) is the global default for the per-video length question; collect in settings later if not on onboarding.

Do not collect occupation/role as the primary onboarding surface.

---

# 5. Two kinds of context

## 5.1 Profile (stable)

Collected at onboarding (and later settings). Typed columns:

```text
year_of_birth
education_level
subjects
summary_style    # optional default for per-video length
```

Reused across videos, including non-educational summaries.

## 5.2 Per-video prefs

Asked after classify, stored on the **analysis row**, not the profile:

```text
familiarity      # not_familiar | somewhat | very   (educational + topic known)
summary_length   # brief | moderate | extensive     (default from summary_style or moderate)
```

These shape **this** summary only. They do not become topic-level knowledge graph entries.

---

# 6. Context questions

Product-owned selects. **Not** LLM-invented keys.

Rules:

* **Familiarity** — educational videos only, and only when classify returned a topic to fill “How familiar are you with {topic}?” Three levels.
* **Length** — when appropriate (typically yes). Three levels. Prefill default from profile `summary_style` or `moderate`.
* Select-only; always skippable; zero / some / all still produce a summary.
* Non-edu: no familiarity question; length still allowed; soft disclaimer.

Do not generate dynamic “missing knowledge” questions. Do not persist paste-time answers into the profile.

---

# 7. Context persistence

Profile fields persist as typed columns and may be edited in settings later.

Per-video prefs persist on `personalized_analyses` so a library reopen shows the same summary and a re-paste can prefill. They are not copied into the profile.

---

# 8. (Reserved)

Topic-scoped EAV and video-specific free-text prefs are **out of MVP**.

---

# 9. YouTube Input

For the MVP, users can add YouTube videos using a YouTube URL.

Do not support uploaded videos in the MVP.

Do not build audio transcription infrastructure in the MVP.

The application should rely on an accessible YouTube transcript/caption source.

The video itself does not need to be downloaded for the primary MVP workflow.

---

# 10. Transcript

The transcript is the primary source material for AI analysis.

Whenever possible, use the transcript provided/available through YouTube.

The transcript should preserve timestamps.

Conceptually:

```text
00:00.000 → "Welcome back..."
00:08.500 → "Today we're going to..."
00:21.200 → "The first important concept..."
```

Timestamped transcript segments are important because they allow the generated **sections** and summaries to be synchronized with the video.

Transcript acquisition should be treated as a separate concern from AI analysis.

Conceptually:

```text
YouTube URL
    ↓
YouTube metadata
    ↓
Transcript acquisition
    ↓
Timestamped transcript
```

If an accessible **English** timestamped transcript cannot be obtained, show a clear error state. Do not fall back to other languages, Whisper, or uploaded audio.

Transcript acquisition uses `youtubei.js` behind a `TranscriptProvider` interface so a residential proxy or small fetch worker can be added later if Vercel datacenter IPs are blocked.

---

# 11. Video Analysis Pipeline

The analysis pipeline is the core backend business logic.

It should be independent from the UI and should not be implemented directly inside a React component or Server Action.

Conceptually:

```text
YouTube URL
    ↓
Stub user_videos + redirect to workspace
    ↓
Get metadata (incl. categoryId hint if available)
    ↓
Get timestamped English transcript
    ↓
Classify (isEducational, confidence, topic?)
    ↓
If appropriate: familiarity and/or length selects (skip allowed)
    ↓
Generate personalized section bodies (profile + per-video prefs)
    ↓
Persist analysis
    ↓
Render video workspace (highlight + seek)
```

The pipeline should be implemented as reusable application/domain logic.

A Server Action should act as an entry point into the pipeline, not contain the entire pipeline itself.

This separation is intentional because the pipeline may eventually need to move into background processing without rewriting the business logic.

---

# 12. Stage 1: Classification

Cheap structured call. Decide whether the video is educational and, if so, name a topic for the familiarity question.

Input:

```text
Video metadata (title, channel, categoryId hint)
+
Short transcript excerpt
```

Output (Zod-validated):

* `isEducational` (boolean)
* `confidence` (`high` | `medium` | `low`) — if ambiguous, **prefer educational**
* `topic?` — short label for “How familiar are you with {topic}?”

YouTube `categoryId` is a **hint** only. Do not treat creator category as ground truth.

**Do not** emit a section skeleton, prerequisites, domains list, or LLM-invented questions in this stage.

---

# 13. Stage 2: Per-video prefs

Product-owned UI, not an LLM stage.

* Familiarity — educational + topic known; 3 levels; skippable
* Length — when appropriate; 3 levels; default from `summary_style` or moderate; skippable

Persist answers on the analysis row. Empty answers are valid. Then run generate.

If not educational: skip familiarity; UI shows a soft disclaimer.

---

# 14. Stage 3: Personalized sections

One generation call **after** prefs (or skip).

Input:

```text
Video metadata
+
Transcript subset
+
Classification (isEducational, topic)
+
Profile (YOB, education level, subjects, summary_style)
+
Per-video prefs (familiarity, summary_length) if any
```

Output: sections, each with:

* title
* start timestamp
* end timestamp
* personalized **body** (depth/framing from profile + prefs)

Short videos may have a **single** section. Do not invent facts absent from the transcript.

Key takeaways / overview are optional later; MVP is section bodies synced to the player.

---

# 15. Personalized Does Not Mean "Rewrite Everything"

Personalization should affect:

* what information is emphasized
* how much background is explained
* terminology
* examples
* level of detail
* what can safely be skipped
* what the user should pay attention to

It should not distort the actual content of the video.

The summary must remain faithful to the source material.

For example, if education level and familiarity with the topic are high, the application can avoid re-explaining basics while emphasizing new intuition.

It should not invent claims because the user appears knowledgeable.

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

For non-educational videos, show a soft disclaimer near the summary (e.g. personalization for learning may be limited).

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
* add a new YouTube video
* optionally remove a video

Do not build advanced search, recommendations, knowledge graphs, or cross-video intelligence in the MVP.

---

# 19. Suggested Database Concepts

All video data is **per-user**. There is **no** shared cross-user cache of metadata, transcripts, or classification.

```text
profiles                 # typed: year_of_birth, education_level, subjects, summary_style
user_videos              # one row per (user_id, youtube_id); metadata + EN transcript snapshot
personalized_analyses    # 1:1 with user_videos: state, classify result, per-video prefs, sections
```

Conceptually:

```text
User
├── profile (stable educational baseline + optional summary_style)
└── User × Video
    ├── user_videos (metadata + transcript; re-paste refreshes this user's row)
    └── personalized_analyses
        ├── status
        ├── classification (isEducational, confidence, topic?)
        ├── per-video prefs (familiarity, summary_length)
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
addVideo()            # stub + redirect; fetch runs in workspace
updateProfile()
submitVideoPrefs()    # optional familiarity / length → then generate
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
├── classifyVideo()      # isEducational, confidence, topic? — no skeleton, no LLM questions
└── generateSections()   # { title, startTime, endTime, body }[] after prefs (or skip)
```

Per-video prefs are product-owned UI, not an AIProvider method.

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

* classification (`isEducational`, `confidence`, `topic?`)
* section titles
* section timestamps (`startTime`, `endTime`)
* section bodies

Do not schema LLM-invented knowledge questions, domains lists, or section skeletons in classify.

---

# 26. Cost Awareness

LLM calls are a significant part of the application's cost.

Design the pipeline to avoid unnecessary calls.

Important principles:

* classify stays tiny (metadata + short excerpt) — do not send the full transcript
* generate is one transcript-shaped call after prefs (or skip)
* cap `maxOutputTokens` on generate
* do not re-run classify in order to write bodies
* do not send the same large transcript twice
* keep prompts focused
* model id lives in `analysisConfig`, not env
* evaluate models using representative videos before committing

---

# 27. Redis

Redis is **not required for the initial MVP**.

Do not introduce Redis simply because it was part of the original technology list.

Potential future uses include:

* background job queues
* temporary processing state
* rate limiting
* caching expensive video-level analysis
* distributed locks

However, none of these should be implemented until there is a concrete requirement.

In particular, do not introduce a worker architecture solely to justify Redis.

The initial application should remain simple.

If video analysis proves too long-running for the chosen Next.js deployment model, revisit background jobs and Redis at that point.

---

# 28. Background Processing

Background workers are out of scope for the initial MVP.

The analysis pipeline should nevertheless be structured so that it can eventually be moved to a worker without rewriting its business logic.

For example:

```text
Today:

Server Action
    ↓
analyzeVideo()
```

Potentially later:

```text
Server Action
    ↓
Queue
    ↓
Worker
    ↓
analyzeVideo()
```

The function `analyzeVideo()` should remain independent from the transport/execution mechanism.

---

# 29. Analysis State

Video analysis can be represented with explicit states.

Potential states:

```text
pending
fetching
classifying
awaiting              # skip when nothing to ask
generating
complete
failed
```

Skip `awaiting` when the video is not educational (no familiarity) and length is not asked, or when neither question is appropriate. Empty answers still proceed to generate.

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

* optional year of birth (`yyyy`, framing)
* education-level enum
* subject interest chips (fixed list + other)
* optional `summary_style` (`brief` / `moderate` / `extensive`) — settings later if not collected here

### Library

* list analyzed videos
* add YouTube video (stub + immediate workspace redirect)
* video processing states
* open video
* delete video

### Video ingestion

* YouTube URL validation
* stub library row then fetch in workspace
* YouTube metadata (categoryId as classifier hint)
* accessible timestamped English transcript

### AI

* cheap classification (`isEducational` + confidence + `topic?`)
* personalized section **bodies** `{ title, startTime, endTime, body }`
* no LLM-invented questions; no classify-time section skeleton

### Profile + per-video prefs

* typed profile (YOB, education level, subjects, summary style)
* optional familiarity (edu + topic known; 3 levels)
* optional summary length (3 levels; default from `summary_style` or moderate)
* skip always allowed; answers persist on the analysis row
* soft disclaimer on non-educational videos

### Video workspace

* YouTube video player
* synchronized sections (highlight + seek)
* section bodies
* soft non-edu disclaimer when applicable

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
* non-English UI or non-English captions
* Playwright / E2E (unit tests only in MVP)
* LLM-invented knowledge questions
* topic / video EAV context
* shared cross-user transcript or classification cache

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
   └── loop continueAnalysis (fetch → classify → generate)
          ├── TranscriptProvider (youtubei.js)
          └── AIProvider (Vercel AI SDK; model from analysisConfig)
```

Do not add infrastructure because it is available.

In particular:

* no tRPC without a concrete API requirement
* Redis/BullMQ for the analysis queue and per-video lock only (not a transcript cache)
* Worker owns fetch/classify/generate; Next does not run the pipeline
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

> A user can paste a real educational YouTube video, land on the workspace immediately, optionally set familiarity and length, and receive useful personalized section **bodies** synchronized with that video — and still get a sectioned summary for non-educational videos with a soft disclaimer.

---

# 38. Definition of Done for the MVP

A user should be able to:

1. Visit the landing page.
2. Create an account.
3. Complete lightweight educational onboarding (or skip).
4. Enter a YouTube URL and land on the workspace immediately.
5. See fetch / classify progress in the workspace (failures surface there).
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
