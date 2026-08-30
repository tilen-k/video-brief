# Architecture

VideoBrief is a Next.js app that turns a YouTube URL into a personalized, timestamped brief. The expensive work (transcript fetch + LLM) runs in a separate BullMQ worker so Generate can redirect immediately and keep working if the user leaves.

## Topology

```text
Browser
  → Vercel (Next.js App Router)
       thin Server Actions → domain functions → Drizzle / Supabase Postgres
       enqueue analyze job ──────────────────┐
       usage reserve/refund (Postgres)       │
                                             ▼
                                    Railway Redis
                                    (BullMQ + per-video lock)
                                             │
                                             ▼
                                    Railway worker
                                    continueAnalysis (one stage per tick)
                                    → youtubei.js → AIProvider (OpenRouter)
```


| Piece     | Host     | Responsibility                                      |
| --------- | -------- | --------------------------------------------------- |
| Web app   | Vercel   | UI, auth cookies, Preview/Generate actions, enqueue |
| Redis     | Railway  | BullMQ queue + short-lived per-video analysis lock  |
| Worker    | Railway  | Fetch transcript, generate summary/sections         |
| Auth + DB | Supabase | Sessions, Postgres + RLS                            |




## Layering

```text
app/ / components/     UI + RSC reads
lib/actions/           Authz, Zod, call domain, enqueue
domain/                Pipeline, usage, ingest, billing rules
db/                    Drizzle schema + client
lib/ai, lib/youtube    Provider adapters (swappable)
worker/                BullMQ runner only (not imported by Next)
```

Server Actions stay thin. Analysis state lives in Postgres; Redis never holds transcripts or LLM output.

## Data model

Re-Generate refreshes the user’s row and resets analysis.

```text
profiles
  summary prefs, plan, Stripe ids

user_videos  (user_id, youtube_id)
  metadata + English transcript snapshot

personalized_analyses  (1:1 with user_videos)
  status, run_id, prefs, model_tier
  overview summary + sections[]

usage_events
  one row per Generate reservation (keyed by run_id)
  refunds set refunded_at; active counts ignore those
```

## Billing (brief)

Stripe Checkout + Customer Portal. Webhooks update `profiles.plan` (`free` | `pro`). Entitlement and metering are separate: plan comes from Stripe; Generate slots are reserved in `usage_events` using limits from `analysisConfig`. Detail: [billing-usage.md](billing-usage.md).

## Code entry points


| Area                 | Start here                                                    |
| -------------------- | ------------------------------------------------------------- |
| Generate action      | `src/lib/actions/library.ts`                                  |
| Domain pipeline      | `src/domain/analysis/continue-analysis.ts`                    |
| Worker loop + lock   | `src/lib/queue/process-analyze-job.ts`, `src/worker/index.ts` |
| Usage reserve/refund | `src/domain/usage/quota.ts`, `event-store.ts`                 |
| AI boundary          | `src/lib/ai/provider.ts`                                      |


