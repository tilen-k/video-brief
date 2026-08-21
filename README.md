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

4. Run SQL in the Supabase SQL editor (in order):

```text
drizzle/0000_profiles.sql
drizzle/0001_user_context.sql
drizzle/0002_user_context_revoke_client_writes.sql
```

5. Install & run:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle (needs `DATABASE_URL`) |

## Docs

- `project-spec.md` — full product/tech spec
- `project-context.md` — short overview
- `.cursor/rules/` — agent rules
