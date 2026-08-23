-- Slice: persist classified understanding + leftover select questions.
-- Existing RLS on personalized_analyses still applies. No new policies.
-- REVOKE ALL from anon/authenticated remains from 0004.

alter table public.personalized_analyses
  add column if not exists understanding jsonb,
  add column if not exists pending_questions jsonb not null default '[]'::jsonb;
