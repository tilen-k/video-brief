---
name: drizzle-table-rls
description: Add or change Drizzle schema tables with migrations and Supabase RLS policies for VideoBrief. Use when creating tables, altering schema, or wiring user-owned data access.
---

# Drizzle table + RLS

## Steps

1. Edit `src/db/schema.ts` (UUID PKs, `createdAt`/`updatedAt`, FKs, indexes).
2. Per-user video model: `user_videos` (metadata + transcript) + `personalized_analyses` (1:1, status machine).
3. Export `$inferSelect` / `$inferInsert` types.
4. `pnpm drizzle-kit generate` then `pnpm drizzle-kit migrate`.
5. Add RLS policies in the same change for every user-owned table:
   - `USING (user_id = auth.uid())` (or equivalent join) for select/update/delete
   - matching `WITH CHECK` for inserts
6. **REVOKE ALL** from `anon`, `authenticated` on user tables — writes via Drizzle `DATABASE_URL` only.

## Checklist

- [ ] Schema change + migration generated
- [ ] RLS enabled (never left off)
- [ ] Policies match ownership model
- [ ] No client-supplied user id trusted in app code
- [ ] Indexes for `userId`, `(userId, youtubeId)`, status filters as needed
