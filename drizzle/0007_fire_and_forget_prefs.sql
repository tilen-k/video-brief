-- Per-video prefs as 0–100 scores, overview summary, run_id for job cancel.
-- Writes stay via Drizzle (DATABASE_URL). Existing RLS policies remain.

alter table public.personalized_analyses
  add column if not exists summary text,
  add column if not exists run_id uuid;

update public.personalized_analyses
set run_id = gen_random_uuid()
where run_id is null;

alter table public.personalized_analyses
  alter column run_id set default gen_random_uuid(),
  alter column run_id set not null;

alter table public.personalized_analyses
  alter column familiarity drop default;

alter table public.personalized_analyses
  alter column familiarity type integer using (
    case familiarity
      when 'not_familiar' then 0
      when 'somewhat' then 50
      when 'very' then 100
      else 50
    end
  );

alter table public.personalized_analyses
  alter column familiarity set default 50,
  alter column familiarity set not null;

alter table public.personalized_analyses
  alter column summary_length drop default;

alter table public.personalized_analyses
  alter column summary_length type integer using (
    case summary_length
      when 'brief' then 25
      when 'moderate' then 50
      when 'extensive' then 75
      else 50
    end
  );

alter table public.personalized_analyses
  alter column summary_length set default 50,
  alter column summary_length set not null;

update public.personalized_analyses
set
  status = 'failed',
  error_code = 'analysis_failed',
  error_message = 'Analysis was interrupted. Paste the link again to retry.'
where status in (
  'awaiting',
  'pending',
  'fetching',
  'classifying',
  'generating'
);
