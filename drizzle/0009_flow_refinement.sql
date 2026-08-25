-- Flow refinement: tone/length defaults, drop classify + edu profile fields.
-- Writes stay via Drizzle (DATABASE_URL). Existing RLS policies remain.

-- Profiles: add tone/length, backfill from summary_style, then drop edu columns.
alter table public.profiles
  add column if not exists summary_tone integer not null default 50,
  add column if not exists summary_length integer not null default 50;

update public.profiles
set
  summary_tone = 50,
  summary_length = case summary_style
    when 'brief' then 25
    when 'extensive' then 75
    else 50
  end
where true;

alter table public.profiles
  drop column if exists year_of_birth,
  drop column if exists education_level,
  drop column if exists subjects,
  drop column if exists summary_style;

-- Analyses: add tone, nullable familiarity, fail classifying rows, drop classification.
alter table public.personalized_analyses
  add column if not exists summary_tone integer not null default 50;

alter table public.personalized_analyses
  alter column familiarity drop not null;

alter table public.personalized_analyses
  alter column familiarity drop default;

-- Keep usage_quota_key so ops/app can refund Redis counters (SQL cannot DECR Redis).
-- After migrate: refund each distinct usage_quota_key for these rows, then optionally null keys.
update public.personalized_analyses
set
  status = 'failed',
  error_code = 'analysis_failed',
  error_message = 'Analysis was interrupted. Generate again from the library to retry.',
  updated_at = now()
where status = 'classifying';

alter table public.personalized_analyses
  drop column if exists classification;
