# VideoBrief — Project Spec

Brand: **VideoBrief** · Domain: **videobrief.app**

Canonical agent rules live in `.cursor/rules/`. Short overview: `project-context.md`.

## 1. Project Overview

We are building an **education-first** web application that turns YouTube videos into **personalized, interactive section summaries** synchronized with playback.

The core product idea is:

> **Paste a YouTube video. The application classifies whether it is educational, understands the content, asks for missing learning context only when useful, and generates personalized section explanations synchronized with the video.**

The application is intentionally **not** a generic "AI YouTube summarizer."

The differentiating feature is **personalization through persistent educational user context** (level, subjects, topic familiarity).

A user should be able to use the application with almost no configuration:

1. Sign up.
2. Complete lightweight educational onboarding (all fields optional).
3. Paste a YouTube URL.
4. The application fetches metadata + English transcript and **classifies** the video (`isEducational`).
5. If educational: show context that will be used; ask up to 3 select-only questions for missing knowledge.
6. If not educational: soft disclaimer; **no** paste-time questions; still produce a sectioned summary using global context.
7. The user may answer zero, some, or all suggested questions (educational path).
8. Useful answers are persisted as user context.
9. The application generates personalized **section** explanations.
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
| Fonts | **Newsreader** (display/brand), **Source Sans 3** (UI/body) |

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
| Default model | Claude Haiku (latest available via AI SDK) |
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
* cursor-ide-browser for UI checks
* Do not rely on Prisma MCP

---

# 4. Onboarding

Onboarding should collect a **lightweight educational baseline**. All fields are optional; skip is allowed.

Do not make onboarding a long questionnaire.

| Field | Storage / behavior |
|-------|--------------------|
| Year of birth | User enters a number; store as `yyyy`. Used for **framing** only (not gating or age gates). |
| Education level | Enum (single select): `middle_school`, `high_school`, `undergrad`, `grad`, `bootcamp`, `self_taught`, `other` |
| Subjects of interest | Multi-select chips from a fixed list; **`other` is the last chip** (no free-text for Other in MVP) |

Suggested subject chips (define as a shared const/enum in code):

`math`, `physics`, `chemistry`, `biology`, `computer_science`, `engineering`, `economics`, `history`, `languages`, `other`

Persist these as global `user_context` keys (e.g. `year_of_birth`, `education_level`, `subjects`).

Do not collect occupation/role or summary-style prefs as the primary onboarding surface for MVP unless product direction changes again.

---

# 5. Dynamic User Context

This is one of the most important product concepts.

The application should **not attempt to collect all useful information during onboarding**.

Instead:

1. User adds a video.
2. The application analyzes and **classifies** the video.
3. If **not** educational → soft disclaimer; skip paste-time questions; generate sectioned summary using global context.
4. If educational → compare video domains/prerequisites with existing user context.
5. Ask only missing knowledge questions (select-only, max 3).
6. Show the user which context will be used.
7. Persist useful answers for reuse.

Example:

Video title: `Taylor series | Chapter 11, Essence of calculus`

Existing context:

```text
education_level: undergrad
subjects: math
topic calculus: intermediate
```

Do **not** re-ask calculus level. Might ask (select):

> How familiar are you with Taylor series?
> none / heard of it / need a refresh / solid

Persist topic-level answers (e.g. `taylor_series = need_refresh`) so related videos skip the same question.

---

# 6. Context Scopes

User context should conceptually exist at multiple levels.

## 6.1 Global Context

Information generally true about the user.

Examples:

```text
year_of_birth: 2003
education_level: undergrad
subjects: math, computer_science
```

This context should be reused across videos (including non-educational summaries).

---

## 6.2 Topic Context

Information about the user's familiarity with a particular topic.

Examples:

```text
calculus: intermediate
taylor_series: need_refresh
react: advanced
```

Topic context can be reused whenever a future educational video is related to that topic.

---

## 6.3 Video-Specific Context

Information that applies only to the current video.

Examples:

```text
Focus:
"Emphasize intuition over proofs."

Preference:
"Skip historical asides."
```

Video-specific context should not automatically become global context.

---

# 7. Context Persistence

If the user provides information that is useful beyond the current video, save it.

The application should avoid asking the same question repeatedly.

For example:

First calculus / Taylor series video:

> How familiar are you with Taylor series?

User:

> need_refresh

Persist:

```text
topic = taylor_series
familiarity = need_refresh
```

A later related video should not ask the same question.

---

# 8. Context Questions

Context questions apply **only when the video is classified educational**.

They are dynamically generated from the video understanding + existing user context.

Rules:

* educational videos only (non-edu → none)
* select-only for MVP (no free-text answers in the paste-time flow)
* **max 3** after filtering against stored context
* relevant, optional, understandable
* useful for improving personalized section explanations
* always skippable

The product should support answering zero, some, or all. Summary must still work with zero answers.

For educational videos, the UI should also display the **current user context that will be used** (global + matching topics) so the user can trust what personalization is based on.

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
Get metadata (incl. categoryId hint if available)
    ↓
Get timestamped English transcript
    ↓
Understand + classify video (isEducational, domains, prereqs, section skeleton)
    ↓
If educational:
    determine useful missing knowledge questions (select, ≤3)
    show applied context → optional answers → persist
If not educational:
    soft disclaimer → skip questions
    ↓
Generate personalized section summaries (always may use global context)
    ↓
Persist analysis
    ↓
Render video workspace
```

The pipeline should be implemented as reusable application/domain logic.

A Server Action should act as an entry point into the pipeline, not contain the entire pipeline itself.

This separation is intentional because the pipeline may eventually need to move into background processing without rewriting the business logic.

---

# 12. Stage 1: Video Understanding & Classification

The first AI stage should understand the video and decide whether it is educational.

Input:

```text
Video metadata (title, description, channel, categoryId hint)
+
Timestamped transcript (or a cost-aware subset)
+
Relevant existing user context (optional at this stage)
```

The system should determine:

* `isEducational` (boolean) — primary product switch
* `confidence` (`high` | `medium` | `low`) — if ambiguous, **prefer educational**
* `domains[]` — learning domains (e.g. calculus, React)
* `prerequisites[]` — useful prior knowledge
* section skeleton (title + start/end times); may be a single section
* candidate context questions (educational path only; filtered later)

YouTube `categoryId` is a **hint** only (e.g. Education=27, Science & Technology=28). Do not treat creator category as ground truth.

Conceptual output:

```json
{
  "isEducational": true,
  "confidence": "high",
  "domains": ["calculus", "taylor_series"],
  "prerequisites": ["derivatives", "limits"],
  "youtubeCategoryId": "27",
  "sections": [
    {
      "title": "Why Taylor series",
      "startTime": 0,
      "endTime": 320
    }
  ],
  "contextQuestions": [
    {
      "key": "topic:taylor_series",
      "question": "How familiar are you with Taylor series?",
      "type": "select",
      "options": ["none", "heard_of_it", "need_refresh", "solid"]
    }
  ]
}
```

The exact schema should be defined and validated in code. Persist classification on the shared video so later users reuse it.

Do not rely on unvalidated arbitrary LLM output.

---

# 13. Stage 2: Additional Context

Run this stage **only if `isEducational`**.

After understanding, compare candidate questions with the user's existing context.

Only show questions that are genuinely useful and not already answered. Cap at **3**. Select-only for MVP.

Example:

```text
Existing user context:
topic calculus = intermediate

Video domains:
calculus, taylor_series

Potential question:
"How comfortable are you with calculus?"

Result:
Do not ask.
```

But:

```text
Potential question:
"How familiar are you with Taylor series?"

Result:
Ask (select).
```

Also show a read-only panel of context that will be used (global + matching topics).

The user can skip all questions. Answers persist by scope (usually topic).

If not educational: skip this stage entirely; UI shows a soft disclaimer.

---

# 14. Stage 3: Personalized Summary

The final analysis uses:

```text
Video metadata
+
Transcript / relevant transcript sections
+
Video-level understanding + classification
+
Global user context (always eligible — including for non-edu)
+
Relevant topic context (mainly educational)
+
Video-specific context (if any)
```

The output should be structured.

### Overview

A concise explanation of what the video is about.

### Sections

Each section should contain:

* title
* start timestamp
* end timestamp
* personalized explanation (depth/framing from user context)
* important points

Short videos may have a **single** section.

### Key Takeaways

A short list of the most important things the user should retain.

For non-educational videos: still produce sections + overview; personalization from global context is allowed; do not invent educational scaffolding that is not in the video.

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

For example, if a user already knows calculus basics, the application can avoid re-explaining prerequisites while emphasizing Taylor series intuition.

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
│ Transcript / controls                 │ AI Summary          │
│                                       │                     │
│                                       │ 01 Introduction     │
│                                       │                     │
│                                       │ Explanation...      │
│                                       │                     │
│                                       │ 02 Core Concept     │
│                                       │                     │
│                                       │ Explanation...      │
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
startTime
endTime
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

Use a **hybrid** model:

**Shared** (keyed by YouTube video id — reusable across users):

```text
videos              # metadata (+ categoryId hint)
video_transcripts   # English timestamped segments
# classification + optional section skeleton on videos or related shared row
```

Shared classification (`isEducational`, confidence, domains, prerequisites) and optional generic section skeleton should live with the shared video when not user-specific.

**Per-user**:

```text
profiles
user_context           # global + topic keys (YOB, education_level, subjects, topic familiarity, …)
library / user_videos
video_context           # answers for this user+video
personalized_analysis   # overview, sections, takeaways
```

Conceptually:

```text
Shared Video (youtubeId)
├── metadata
├── English transcript
├── classification (isEducational, …)
└── optional section skeleton

User × Video
├── library membership
├── video-specific context
└── personalized analysis
    ├── context used
    ├── personalized overview
    └── personalized sections
```

The exact schema should avoid unnecessary duplication and should be normalized where useful. Implement with Drizzle; enforce RLS on all user-owned tables.

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

* user context
* preferences
* saved videos
* personalized analyses
* notes, if notes are added later

Shared/global video information can have different access policies if introduced.

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
addVideo()
updateProfile()
saveContext()
submitContextAnswers()
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

MVP default: **Claude Haiku** for all pipeline stages (cost/latency).

Conceptually:

```text
AIProvider
├── understandAndClassifyVideo()  # includes isEducational + section skeleton
├── determineContextQuestions()   # educational path only; max 3 selects after filter
└── generatePersonalizedSummary() # section explanations
```

The actual implementation may combine these operations when appropriate.

Do not scatter direct Anthropic SDK calls outside the provider module.

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

* section timestamps
* section titles
* summaries / explanations
* key points
* domains / prerequisites
* classification (`isEducational`, confidence)
* context questions (select options)
* final takeaways

---

# 26. Cost Awareness

LLM calls are a significant part of the application's cost.

Design the pipeline to avoid unnecessary calls.

Important principles:

* do not send the same large transcript to the model unnecessarily
* reuse structured intermediate analysis
* avoid asking questions already answered by stored user context
* do not run a second expensive generation step if the first result is already sufficient
* keep prompts focused
* use cheaper models where quality is sufficient
* evaluate models using representative videos before committing

A potential optimization is:

```text
Transcript
   ↓
Video analysis
   ↓
structured intermediate representation
   ↓
personalization
```

rather than repeatedly sending the entire transcript.

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
fetching_transcript
analyzing
awaiting_context      # educational only; skip when non-edu or no questions
generating_summary
complete
failed
```

The exact state machine should be kept as simple as possible. Skip `awaiting_context` when the video is not educational or when no useful questions remain after filtering.

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

### Library

* list analyzed videos
* add YouTube video
* video processing states
* open video
* delete video

### Video ingestion

* YouTube URL validation
* YouTube metadata (categoryId as classifier hint)
* accessible timestamped English transcript

### AI

* educational classification (`isEducational` + confidence + domains/prereqs)
* section skeleton generation
* context question generation (educational only; select; max 3)
* personalized section explanations
* key takeaways

### User context

* global educational baseline
* topic context where useful
* video-specific context when needed
* persistent context reuse
* optional context questions on educational videos only
* soft disclaimer on non-educational videos

### Video workspace

* YouTube video player
* synchronized sections (highlight + seek)
* section explanations
* overview / takeaways
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

* Display / brand: **Newsreader**
* UI / body: **Source Sans 3**

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
  │ YouTube URL
  ▼
VIDEO UNDERSTANDING + CLASSIFICATION
  │
  ├── Is this educational?
  ├── What domains / prerequisites?
  ├── How is it structured into sections?
  └── What missing knowledge would help? (edu only)
  │
  ▼
USER CONTEXT
  │
  ├── Existing global context (YOB, education, subjects)
  ├── Existing topic context
  └── Optional new answers (edu only; ≤3 selects)
  │
  ▼
PERSONALIZED ANALYSIS
  │
  ├── Overview
  ├── Sections + explanations
  └── Key takeaways
  │
  ▼
VIDEO WORKSPACE
  │
  └── Video synchronized with active section
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
   ├── Server Actions (thin)
   ├── TanStack Query (client status / mutations)
   └── domain/application logic
          │
          ├── Drizzle → Supabase Postgres (+ RLS)
          ├── TranscriptProvider (youtubei.js)
          └── AIProvider (Vercel AI SDK → Claude Haiku)
```

Do not add infrastructure because it is available.

In particular:

* no tRPC without a concrete API requirement
* no Redis without a concrete Redis-shaped problem
* no worker without a background-processing requirement
* no Prisma (Drizzle is locked)
* no abstraction without a reason
* no feature without a product purpose

The architecture should be allowed to evolve when the actual application exposes real constraints.

---

# 37. Development Priorities

Build in this order:

1. Project setup
2. Supabase authentication
3. Database schema + RLS
4. Basic educational onboarding (YOB, education level, subjects)
5. User context persistence
6. Library UI
7. YouTube URL ingestion
8. Transcript acquisition
9. Video understanding + educational classification
10. Dynamic context questions (educational only; max 3 selects)
11. Personalized section summary generation
12. Video workspace
13. Timestamp synchronization (section highlight + seek)
14. Soft non-edu disclaimer + error/loading states
15. Unit tests (Vitest) for schemas and domain helpers
16. Visual polish
17. Responsive/mobile behavior

Do not begin by implementing every possible AI feature.

The most important milestone is:

> A user can paste a real educational YouTube video, optionally answer a few knowledge questions, and receive useful personalized sections synchronized with that video — and still get a sectioned summary for non-educational videos with a soft disclaimer.

---

# 38. Definition of Done for the MVP

A user should be able to:

1. Visit the landing page.
2. Create an account.
3. Complete lightweight educational onboarding (or skip).
4. Enter a YouTube URL.
5. Wait while the application processes and classifies the video.
6. If educational: see applied context and optional select questions (≤3); skip some or all.
7. If not educational: see a soft disclaimer and no knowledge questions.
8. Have useful answers persisted when provided.
9. Receive a personalized sectioned summary (global context used when present).
10. Watch the video.
11. See the relevant section highlighted as the video progresses.
12. Click a section and jump to that point in the video.
13. Return to the library and find the analyzed video.
14. Open the video again later with its saved analysis.

If all of this works reliably, the MVP is successful.

---

# 39. Guiding Question

Whenever making an architectural or product decision, ask:

> **Does this help turn a user's YouTube video into a better personalized understanding of that video — especially for learning?**

If not, it probably belongs outside the MVP.
