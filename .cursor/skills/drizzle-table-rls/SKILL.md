---
name: drizzle-table-rls
description: Add or change Drizzle schema tables with migrations and Supabase RLS policies for VideoBrief. Use when creating tables, altering schema, or wiring user-owned data access.
---

# Drizzle table + RLS

## Steps

1. Edit `src/db/schema.ts` (UUID PKs, `createdAt`/`updatedAt`, FKs, indexes).
2. Per-user video model: `user_videos` (metadata + transcript) + `personalized_analyses` (1:1: status, classify result, per-video prefs, section bodies). Typed profile columns — not EAV.
3. Export `$inferSelect` / `$inferInsert` types.
4. `pnpm db:generate` then `pnpm db:migrate` (Drizzle Kit is the migrator; journal lives in `drizzle/meta/`).
5. Do **not** dual-apply the same migration via Supabase MCP `apply_migration` or the SQL editor — Kit owns apply after generate.
6. Add RLS policies in the same change for every user-owned table:
   - `USING (user_id = auth.uid())` (or equivalent join) for select/update/delete
   - matching `WITH CHECK` for inserts
7. **REVOKE ALL** from `anon`, `authenticated` on user tables — writes via Drizzle `DATABASE_URL` only.

## Checklist

- [ ] Schema change + migration generated
- [ ] RLS enabled (never left off)
- [ ] Policies match ownership model
- [ ] No client-supplied user id trusted in app code
- [ ] Indexes for `userId`, `(userId, youtubeId)`, status filters as needed
