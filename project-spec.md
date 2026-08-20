# VideoBrief — Project Spec

Brand: **VideoBrief** · Domain: **videobrief.app**

Canonical agent rules live in `.cursor/rules/`. Short overview: `project-context.md`.

## 1. Project Overview

We are building a web application that turns YouTube videos into **personalized, interactive summaries**.

The core product idea is:

> **Paste any YouTube video. The application understands what the video is about, understands what would be useful for this particular user, asks for additional context only when necessary, and generates a personalized summary synchronized with the video.**

The application is intentionally **not** a generic "AI YouTube summarizer."

The differentiating feature is **personalization through persistent user context**.

A user should be able to use the application with almost no configuration:

1. Sign up.
2. Complete lightweight onboarding.
3. Paste a YouTube URL.
4. The application analyzes the video.
5. The application determines whether additional user context would materially improve the result.
6. The user may answer zero, some, or all of the suggested questions.
7. The useful answers are persisted as user context.
8. The application generates a personalized summary.
9. The user watches the video alongside a synchronized summary/chapter panel.

The application should work across many types of YouTube content, including but not limited to:

* educational videos
* technical tutorials
* podcasts
* interviews
* gaming videos
* reviews
* commentary
* political content
* lectures
* conference talks
* documentaries
* general-interest videos

Video type should be determined dynamically from the content. Do not design the product around a fixed category list.

---

# 2. Product Philosophy

The application should feel like a **personalized video knowledge tool**, not an AI chatbot.

The primary interaction is:

> **Watch → understand → remember**

The AI should be largely invisible in the final interface. The user should primarily see useful information, chapters, summaries, and context-aware explanations rather than a chat interface.

The product should be simple enough that the main workflow is immediately understandable.

Avoid feature creep.

The MVP should do one thing exceptionally well:

> **Turn a YouTube video into a personalized, synchronized summary.**

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

Onboarding should collect **general, relatively stable user context**.

Do not make onboarding a long questionnaire.

The goal is to establish enough baseline context for the application to personalize future video analyses.

Potential information includes:

* occupation / role
* general background
* areas of expertise
* interests
* topics they commonly care about
* preferred summary style
* preferred level of detail
* free-form description of themselves or what they want from the application

The exact questions should remain lightweight.

Example:

> Tell us a little about yourself.

> I'm a frontend developer interested in AI and distributed systems. I usually watch technical content and startup interviews.

The user should be able to provide as much or as little information as they want.

Do not make every field mandatory.

---

# 5. Dynamic User Context

This is one of the most important product concepts.

The application should **not attempt to collect all useful information during onboarding**.

Instead:

1. User adds a video.
2. The application analyzes the video.
3. The application compares the video with existing user context.
4. It determines what additional information could meaningfully improve the summary.
5. It optionally asks the user for that information.
6. The answers are persisted and can be reused later.

Example:

A user adds a technical React tutorial.

The application already knows:

```text
Role: Frontend developer
React experience: Advanced
```

It should not ask:

> How experienced are you with React?

Instead, it might ask:

> What are you hoping to get from this video?

Possible answers:

* Learn the concept
* Apply it to a project
* Decide whether to use the technology
* General interest

The answer can be saved as video-specific context or potentially inform broader preferences depending on its nature.

---

# 6. Context Scopes

User context should conceptually exist at multiple levels.

## 6.1 Global Context

Information generally true about the user.

Examples:

```text
Role: Frontend developer
Experience: 4 years
Interests: AI, web development
Preferred summary style: concise
```

This context should be reused across videos.

---

## 6.2 Topic Context

Information about the user's familiarity with a particular topic.

Examples:

```text
React: advanced
TypeScript: intermediate
Machine Learning: beginner
Kubernetes: unfamiliar
```

Topic context can be reused whenever a future video is related to that topic.

---

## 6.3 Video-Specific Context

Information that applies only to the current video.

Examples:

```text
Purpose:
"I am evaluating this architecture for work."

Focus:
"Focus on implementation details."

Preference:
"Skip the historical background."
```

Video-specific context should not automatically become global context.

---

# 7. Context Persistence

If the user provides information that is useful beyond the current video, save it.

The application should avoid asking the same question repeatedly.

For example:

First React video:

> How comfortable are you with React?

User:

> Advanced.

Persist:

```text
topic = React
experience = advanced
```

A month later, another React video should not ask the same question.

Instead, the application should use the existing context and only ask for genuinely missing information.

---

# 8. Context Questions

Context questions are dynamically generated based on the video and existing user context.

Questions should be:

* relevant
* minimal
* optional
* understandable
* specific to the content
* useful for improving the final summary

The user must always have the ability to skip them.

The product should support:

```text
0 additional answers
1 additional answer
multiple additional answers
```

The application must still generate a high-quality summary when the user provides no additional information.

More context should improve personalization, but context should never be a hard requirement for analysis.

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

Timestamped transcript segments are important because they allow the generated chapters and summaries to be synchronized with the video.

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
Get metadata
    ↓
Get timestamped transcript
    ↓
Understand video
    ↓
Determine video type/topics/structure
    ↓
Determine useful missing user context
    ↓
Ask optional context questions
    ↓
Persist new context
    ↓
Generate personalized summary
    ↓
Persist analysis
    ↓
Render video workspace
```

The pipeline should be implemented as reusable application/domain logic.

A Server Action should act as an entry point into the pipeline, not contain the entire pipeline itself.

For example, conceptually:

```text
Server Action
    ↓
analyzeVideo(...)
    ↓
video analysis pipeline
```

This separation is intentional because the pipeline may eventually need to move into background processing without rewriting the business logic.

---

# 12. Stage 1: Video Understanding

The first AI stage should understand the video itself.

Input:

```text
Video metadata
+
Timestamped transcript
+
Relevant existing user context
```

The system should determine things such as:

* likely video type
* major topics
* important concepts
* structure
* chapters
* key sections
* potentially useful missing user context

The output should be structured data.

Conceptually:

```json
{
  "videoType": "technical_tutorial",
  "topics": ["React", "Server Components", "Next.js"],
  "chapters": [
    {
      "title": "What Server Components Are",
      "startTime": 0,
      "endTime": 320
    }
  ],
  "contextQuestions": [
    {
      "key": "learning_goal",
      "question": "What are you hoping to get from this video?",
      "type": "select"
    }
  ]
}
```

The exact schema should be defined and validated in code.

Do not rely on unvalidated arbitrary LLM output.

---

# 13. Stage 2: Additional Context

After the initial video understanding, compare the suggested context questions with the user's existing context.

Only show questions that are genuinely useful and not already answered.

Example:

```text
Existing user context:
React = advanced

Video:
Advanced React Server Components tutorial

Potential question:
"How comfortable are you with React?"

Result:
Do not ask.
```

But:

```text
Potential question:
"What are you watching this for?"

Result:
Ask.
```

The user can skip the question.

Answers should be persisted according to their appropriate scope.

---

# 14. Stage 3: Personalized Summary

The final analysis uses:

```text
Video metadata
+
Transcript / relevant transcript sections
+
Video-level understanding
+
Global user context
+
Relevant topic context
+
Video-specific context
```

The output should be structured.

The primary output should include:

### Overview

A concise explanation of what the video is about.

### Chapters

Each chapter should contain:

* title
* start timestamp
* end timestamp
* personalized summary
* important points

### Key Takeaways

A short list of the most important things the user should retain.

Additional structured fields can be introduced when they have a clear product purpose.

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

For example, if a user is an expert in React, the application can avoid explaining basic React concepts while emphasizing the new material.

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
│                                       │                    │
│                                       │ Summary...          │
│                                       │                    │
│                                       │ 02 Core Concept     │
│                                       │                    │
│                                       │ Summary...          │
│                                       │                    │
└───────────────────────────────────────┴─────────────────────┘
```

The exact visual design will be developed in Figma.

The most important interaction is synchronization.

---

# 17. Synchronized Chapters

Each generated chapter has:

```text
startTime
endTime
```

The video player exposes `currentTime`.

The frontend determines the active chapter:

```text
currentTime >= startTime
AND
currentTime < endTime
```

The active chapter should:

* visually highlight
* optionally scroll into view
* remain synchronized as the video plays

Clicking a chapter should seek the video to its `startTime`.

This synchronization should be handled on the client.

Do not make AI calls during video playback.

AI prepares the structured information ahead of time; the frontend handles synchronization.

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
videos              # metadata
video_transcripts   # English timestamped segments
```

Optional shared generic structure (type/topics/chapter skeleton) may live with the shared video if it is not user-specific.

**Per-user**:

```text
profiles
user_preferences / user_context
topic_context
library / user_videos
video_context           # answers for this user+video
personalized_analysis   # overview, chapters, takeaways
```

Conceptually:

```text
Shared Video (youtubeId)
├── metadata
├── English transcript
└── optional generic structure

User × Video
├── library membership
├── video-specific context
└── personalized analysis
    ├── context used
    ├── personalized summary
    └── personalized chapters
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
├── analyzeVideo()
├── determineContextQuestions()
└── generatePersonalizedSummary()
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

* chapter timestamps
* chapter titles
* summaries
* key points
* topics
* context questions
* video type
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
awaiting_context
generating_summary
complete
failed
```

The exact state machine should be kept as simple as possible.

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

* lightweight global user context
* summary preferences

### Library

* list analyzed videos
* add YouTube video
* video processing states
* open video
* delete video

### Video ingestion

* YouTube URL validation
* YouTube metadata
* accessible timestamped transcript

### AI

* video classification
* topic extraction
* chapter generation
* context question generation
* personalized summary
* key takeaways

### User context

* global context
* topic context where useful
* video-specific context
* persistent context reuse
* optional context questions

### Video workspace

* YouTube video player
* synchronized chapters
* chapter summaries
* key points
* overview
* takeaways

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
video ↔ chapter ↔ summary
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
VIDEO UNDERSTANDING
  │
  ├── What is this?
  ├── What are the important topics?
  ├── How is it structured?
  └── What context would help?
  │
  ▼
USER CONTEXT
  │
  ├── Existing global context
  ├── Existing topic context
  └── Optional new information
  │
  ▼
PERSONALIZED ANALYSIS
  │
  ├── Overview
  ├── Chapters
  ├── Summaries
  └── Key takeaways
  │
  ▼
VIDEO WORKSPACE
  │
  └── Video synchronized with summary
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
4. Basic onboarding
5. User context persistence
6. Library UI
7. YouTube URL ingestion
8. Transcript acquisition
9. Video analysis pipeline
10. Dynamic context questions
11. Personalized summary generation
12. Video workspace
13. Timestamp synchronization
14. Error/loading states
15. Unit tests (Vitest) for schemas and domain helpers
16. Visual polish
17. Responsive/mobile behavior

Do not begin by implementing every possible AI feature.

The most important milestone is:

> A user can paste a real YouTube video and receive a useful personalized summary synchronized with that video.

---

# 38. Definition of Done for the MVP

A user should be able to:

1. Visit the landing page.
2. Create an account.
3. Complete lightweight onboarding.
4. Enter a YouTube URL.
5. Wait while the application processes the video.
6. See optional context questions if they are useful.
7. Skip some or all questions.
8. Have useful answers persisted.
9. Receive a personalized summary.
10. Watch the video.
11. See the relevant chapter highlighted as the video progresses.
12. Click a chapter and jump to that point in the video.
13. Return to the library and find the analyzed video.
14. Open the video again later with its saved analysis.

If all of this works reliably, the MVP is successful.

---

# 39. Guiding Question

Whenever making an architectural or product decision, ask:

> **Does this help us turn a user's YouTube video into a better personalized understanding of that video?**

If not, it probably belongs outside the MVP.
