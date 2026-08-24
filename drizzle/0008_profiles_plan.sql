-- Plan tier for usage limits (free | pro). Writes via Drizzle only.
alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro'));

-- Quota key consumed at paste (for month-safe refunds). Writes via Drizzle only.
alter table public.personalized_analyses
  add column if not exists usage_quota_key text;
