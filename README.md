# VideoBrief

Contextual YouTube summarizer — personalized section summaries synchronized with the video.

## Stack

Next.js App Router · Tailwind · shadcn · Supabase Auth · Drizzle · next-intl · TanStack Query · Vitest · BullMQ + Redis

**Production:** Vercel (web) · Railway (Redis + analysis worker) · Supabase (Auth + Postgres)

## Setup

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

5. Redis (analysis queue). From the repo root:

```bash
docker compose up -d redis
```

Set `REDIS_URL=redis://127.0.0.1:6379` in `.env.local` (see `.env.example`).

6. Install & run (two processes):

```bash
pnpm install
pnpm dev
pnpm worker
```

Open [http://localhost:3000](http://localhost:3000). Preview a URL on the library, then Generate — the worker fetches the transcript and generates.

## Deploy (Vercel + Railway + Supabase)

| Piece | Host | Role |
|-------|------|------|
| Next.js app | Vercel | UI, auth cookies, enqueue jobs, usage counters |
| Redis | Railway plugin | BullMQ queue + locks + monthly Generate counters |
| Analysis worker | Railway service | `pnpm worker:prod` — fetch / generate |
| Auth + Postgres | Supabase | Same project as local |

### Railway

1. Create a project → **Add Redis**.
2. **New service** from this GitHub repo (worker only — do not host the Next app here).
3. `railway.json` sets build/install + `pnpm worker:prod` and restart-on-failure.
4. Variables on the **worker** service:

   | Variable | Notes |
   |----------|--------|
   | `REDIS_URL` | Railway Redis **public** TCP URL (`rediss://…` or `redis://…`) — not private |
   | `DATABASE_URL` | Supabase Transaction pooler (`:6543`) |
   | `OPENROUTER_API_KEY` | Required |
   | `YOUTUBE_PROXY_URL` | Recommended (datacenter IPs often blocked) |
   | `YOUTUBE_PROXY_COUNTRY` | Optional, e.g. `us` |
   | `LOG_LEVEL` | Optional (`info` in prod) |

   `ANALYSIS_WORKER=1` is set by `worker:prod`; you do not need to set it manually.

5. No public domain on the worker.

### Vercel

1. Existing project for this repo (e.g. `video-brief-app.vercel.app`).
2. Variables:

   | Variable | Notes |
   |----------|--------|
   | `NEXT_PUBLIC_SITE_URL` | `https://video-brief-app.vercel.app` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Same as local |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as local |
   | `DATABASE_URL` | Supabase Transaction pooler |
   | `REDIS_URL` | **Same public** Railway Redis URL as the worker |
   | `OPENROUTER_API_KEY` | Optional on web today (AI runs in the worker) |

3. Redeploy after setting `REDIS_URL`.

### Supabase Auth (production)

Add redirect URL: `https://video-brief-app.vercel.app/auth/callback` (and Google OAuth client redirect if used).

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

- `project-spec.md` — full product/tech spec
- `project-context.md` — short overview
- `.cursor/rules/` — agent rules
