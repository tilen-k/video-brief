# VideoBrief

Education-first personalized YouTube summaries synchronized with the video. Non-educational videos still get a sectioned summary with a soft disclaimer.

## Stack (slice 0)

Next.js App Router · Tailwind · shadcn · Supabase Auth · Drizzle · next-intl · TanStack Query · Vitest

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

4. Run SQL in the Supabase SQL editor (in order): `drizzle/0000_*.sql` through `drizzle/0007_*.sql`.

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

Open [http://localhost:3000](http://localhost:3000). Paste stays on the library; the worker fetches, classifies, and generates.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm worker` | BullMQ analysis worker (needs Redis) |
| `pnpm build` / `pnpm start` | Production |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle (needs `DATABASE_URL`) |

## Docs

- `project-spec.md` — full product/tech spec
- `project-context.md` — short overview
- `.cursor/rules/` — agent rules
