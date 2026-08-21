-- Slice 1: global user_context + RLS
-- Run in Supabase SQL editor after 0000_profiles.sql

create table if not exists public.user_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'global',
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_context_user_scope_key_uidx
  on public.user_context (user_id, scope, key);

create index if not exists user_context_user_id_idx
  on public.user_context (user_id);

alter table public.user_context enable row level security;

create policy "Users can select own context"
  on public.user_context
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own context"
  on public.user_context
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own context"
  on public.user_context
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own context"
  on public.user_context
  for delete
  using (auth.uid() = user_id);
