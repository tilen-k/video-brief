-- Typed profile columns, per-video prefs on analyses, drop EAV user_context.
-- Writes stay via Drizzle (DATABASE_URL). Existing RLS policies remain.

alter table public.profiles
  add column if not exists year_of_birth integer,
  add column if not exists education_level text,
  add column if not exists subjects jsonb,
  add column if not exists summary_style text;

update public.profiles as p
set year_of_birth = (
  select nullif(uc.value, '')::integer
  from public.user_context as uc
  where uc.user_id = p.id
    and uc.scope = 'global'
    and uc.key = 'year_of_birth'
    and uc.value ~ '^[0-9]+$'
  limit 1
)
where p.year_of_birth is null;

update public.profiles as p
set education_level = (
  select uc.value
  from public.user_context as uc
  where uc.user_id = p.id
    and uc.scope = 'global'
    and uc.key = 'education_level'
  limit 1
)
where p.education_level is null;

update public.profiles as p
set subjects = (
  select to_jsonb(string_to_array(uc.value, ','))
  from public.user_context as uc
  where uc.user_id = p.id
    and uc.scope = 'global'
    and uc.key = 'subjects'
    and uc.value <> ''
  limit 1
)
where p.subjects is null;

alter table public.personalized_analyses
  add column if not exists classification jsonb,
  add column if not exists familiarity text,
  add column if not exists summary_length text,
  add column if not exists sections jsonb not null default '[]'::jsonb;

update public.personalized_analyses
set status = 'fetching'
where status = 'fetching_transcript';

update public.personalized_analyses
set status = 'classifying'
where status = 'analyzing';

update public.personalized_analyses
set status = 'awaiting'
where status = 'awaiting_context';

update public.personalized_analyses
set status = 'generating'
where status = 'generating_summary';

-- Old complete rows only had skeleton titles. Reset so generate can write bodies.
update public.personalized_analyses
set
  status = 'pending',
  classification = null,
  sections = '[]'::jsonb,
  error_code = null,
  error_message = null,
  updated_at = now()
where status in ('fetching', 'classifying', 'awaiting', 'generating', 'complete');

alter table public.personalized_analyses
  drop column if exists understanding,
  drop column if exists pending_questions;

drop table if exists public.user_context;

revoke all on table public.profiles from anon, authenticated;
