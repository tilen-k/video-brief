-- Tighten user_context: app writes via Drizzle (DATABASE_URL) only.
-- RLS alone still allowed clients to upsert arbitrary keys/values via PostgREST,
-- bypassing Server Action Zod validation (incl. year_of_birth / education enums).

revoke all on table public.user_context from anon, authenticated;

-- Policies remain for defense-in-depth if grants are re-added later.
