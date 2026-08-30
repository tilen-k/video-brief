-- Usage ledger (replaces Redis counters). Writes via Drizzle (DATABASE_URL) only.
-- Drop the Redis key pointer on analyses; refunds use usage_events.run_id.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_id uuid not null,
  tier text not null,
  period_day text not null,
  period_hour text not null,
  ip_hash text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint usage_events_tier_check check (tier in ('basic', 'advanced'))
);

create unique index if not exists usage_events_run_id_uidx
  on public.usage_events (run_id);

create index if not exists usage_events_user_day_tier_active_idx
  on public.usage_events (user_id, period_day, tier)
  where refunded_at is null;

create index if not exists usage_events_day_tier_active_idx
  on public.usage_events (period_day, tier)
  where refunded_at is null;

create index if not exists usage_events_hour_tier_active_idx
  on public.usage_events (period_hour, tier)
  where refunded_at is null;

create index if not exists usage_events_ip_day_tier_active_idx
  on public.usage_events (ip_hash, period_day, tier)
  where refunded_at is null;

alter table public.usage_events enable row level security;

create policy "Users can select own usage events"
  on public.usage_events
  for select
  using (auth.uid() = user_id);

revoke all on table public.usage_events from anon, authenticated;

alter table public.personalized_analyses
  drop column if exists usage_quota_key;
