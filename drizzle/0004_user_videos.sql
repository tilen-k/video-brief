-- Refactor: per-user video rows (drop hybrid shared cache).
-- Destructive — dev data in videos/library_items/etc. is discarded.

drop table if exists public.personalized_analyses cascade;
drop table if exists public.library_items cascade;
drop table if exists public.video_transcripts cascade;
drop table if exists public.videos cascade;

create table if not exists public.user_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  youtube_id text not null,
  title text not null,
  channel_title text,
  thumbnail_url text,
  duration_seconds integer,
  youtube_category_id text,
  transcript_language text not null default 'en',
  transcript_segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_videos_user_youtube_uidx
  on public.user_videos (user_id, youtube_id);

create index if not exists user_videos_user_updated_idx
  on public.user_videos (user_id, updated_at desc);

alter table public.user_videos enable row level security;

create policy "Users can select own user videos"
  on public.user_videos
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own user videos"
  on public.user_videos
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own user videos"
  on public.user_videos
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own user videos"
  on public.user_videos
  for delete
  using (auth.uid() = user_id);

create table if not exists public.personalized_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_video_id uuid not null references public.user_videos (id) on delete cascade,
  status text not null default 'pending',
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists personalized_analyses_user_video_uidx
  on public.personalized_analyses (user_video_id);

create index if not exists personalized_analyses_user_id_idx
  on public.personalized_analyses (user_id);

create index if not exists personalized_analyses_user_status_idx
  on public.personalized_analyses (user_id, status);

alter table public.personalized_analyses enable row level security;

create policy "Users can select own analyses"
  on public.personalized_analyses
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own analyses"
  on public.personalized_analyses
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own analyses"
  on public.personalized_analyses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own analyses"
  on public.personalized_analyses
  for delete
  using (auth.uid() = user_id);

revoke all on table public.user_videos from anon, authenticated;
revoke all on table public.personalized_analyses from anon, authenticated;
