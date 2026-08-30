# VideoBrief

Contextual YouTube summarizer: personalized section summaries synchronized with the video.

**Live:** [videobrief-demo.vercel.app](https://videobrief-demo.vercel.app/)

## Engineering highlights

- **Async analysis** — Generate reserves usage, enqueues a BullMQ job; a Railway runs the LLM ([pipeline](docs/analysis-pipeline.md))
- **Redis for coordination** — queue + per-video lock; ([architecture](docs/architecture.md))
- **Guest → account without data loss** — anonymous Supabase session; convert/`linkIdentity` keeps the same `user.id` ([auth](docs/auth-guests.md))
- **Stripe** — webhooks update `profiles.plan`; Generate slots are `usage_events` with refunds by `run_id` ([billing & usage](docs/billing-usage.md))

More context: [docs/decisions.md](docs/decisions.md).

## Stack

Next.js App Router · Tailwind · shadcn · Supabase Auth · Drizzle · next-intl · TanStack Query · Vitest · BullMQ + Redis · Stripe

**Production:** Vercel (web) · Railway (Redis + analysis worker) · Supabase (Auth + Postgres)

## Local development

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Create a Supabase project and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL` (pooler URI)

3. Auth settings in Supabase:
   - Enable email/password
   - Soft confirm: turn **off** “Confirm email” (or allow unconfirmed sign-in)
   - Optional: enable Google provider + add redirect `http://localhost:3000/auth/callback`

4. Apply migrations (needs `DATABASE_URL` — use the Transaction pooler URI):

```bash
pnpm db:migrate
```

Schema changes go through Drizzle Kit only: edit `src/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`. Do not re-apply the same DDL via the Supabase SQL editor or MCP `apply_migration`.

5. Redis (BullMQ queue + per-video lock — not usage). From the repo root:

```bash
docker compose up -d redis
```

Set `REDIS_URL=redis://127.0.0.1:6379` in `.env.local` (see `.env.example`).

6. Install and run **two** processes:

```bash
pnpm install
pnpm dev
pnpm worker
```

Open [http://localhost:3000](http://localhost:3000).

### Stripe (optional, local)

Not needed for Preview/Generate. Uncomment the three `STRIPE_*` vars in `.env.local` (see `.env.example`).

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` from the CLI output.

## Production deployment

| Piece | Host | Role |
|-------|------|------|
| Next.js app | Vercel | UI, auth cookies, enqueue jobs, usage (Postgres) |
| Redis | Railway plugin | BullMQ queue + per-video lock |
| Analysis worker | Railway service | `pnpm worker:prod` — fetch / generate |
| Auth + Postgres | Supabase | Same project as local |

### Railway

1. Create a project → **Add Redis**.
2. **New service** from the GitHub repo (worker only, not Next app).
3. `railway.json` sets build/install + `pnpm worker:prod` and restart-on-failure.
4. Variables on the **worker** service:

   | Variable | Notes |
   |----------|--------|
   | `REDIS_URL` | Railway Redis **public** TCP URL (`rediss://…` or `redis://…`) — not private |
   | `DATABASE_URL` | Supabase Transaction pooler (`:6543`) |
   | `OPENROUTER_API_KEY` | Required |
   | `YOUTUBE_PROXY_URL` | Recommended |
   | `YOUTUBE_PROXY_COUNTRY` | Optional, e.g. `us` |
   | `LOG_LEVEL` | Optional (`info` in prod) |

   `ANALYSIS_WORKER=1` is set by `worker:prod`

5. No public domain on the worker.

### Vercel

1. Existing project for this repo (e.g. `https://videobrief-demo.vercel.app/`).
2. Variables:

   | Variable | Notes |
   |----------|--------|
   | `NEXT_PUBLIC_SITE_URL` | `https://videobrief-demo.vercel.app/` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Same as local |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as local |
   | `DATABASE_URL` | Supabase Transaction pooler |
   | `REDIS_URL` | **Same public** Railway Redis URL as the worker |
   | `OPENROUTER_API_KEY` | Optional on web |
   | `STRIPE_*` | If billing enabled (see `.env.example`) |

3. Redeploy after setting `REDIS_URL`.

### Supabase Auth (production)

Add redirect URL: `https://your.domain/auth/callback` (and Google OAuth client redirect if used).

Dashboard (optional billing): Pro monthly price, Customer Portal, webhook → `/api/stripe/webhook` (subscription + checkout + invoice events).

### Smoke check

Paste a YouTube URL on the library → Railway worker logs show the job → workspace reaches complete.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm worker` | BullMQ worker (local; loads `.env.local`) |
| `pnpm worker:prod` | BullMQ worker (Railway; platform env) |
| `pnpm build` / `pnpm start` | Production Next.js |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle (needs `DATABASE_URL`) |

## Docs

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | Topology, layers, Redis vs Postgres |
| [docs/analysis-pipeline.md](docs/analysis-pipeline.md) | Preview → Generate → BullMQ → workspace |
| [docs/billing-usage.md](docs/billing-usage.md) | Stripe plan vs Postgres quotas |
| [docs/auth-guests.md](docs/auth-guests.md) | Anonymous sessions and convert |