-- Slice 2 (superseded by 0004_user_videos.sql): hybrid shared cache — do not apply on fresh installs if 0004 is used instead.
-- Writes via Drizzle (DATABASE_URL) only; revoke PostgREST client grants.

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null,
  title text not null,
  channel_title text,
  thumbnail_url text,
  duration_seconds integer,
  youtube_category_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists videos_youtube_id_uidx
  on public.videos (youtube_id);

alter table public.videos enable row level security;

create policy "Authenticated can select videos"
  on public.videos
  for select
  to authenticated
  using (true);

create table if not exists public.video_transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  language text not null default 'en',
  segments jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists video_transcripts_video_id_uidx
  on public.video_transcripts (video_id);

alter table public.video_transcripts enable row level security;

create policy "Authenticated can select video transcripts"
  on public.video_transcripts
  for select
  to authenticated
  using (true);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists library_items_user_video_uidx
  on public.library_items (user_id, video_id);

create index if not exists library_items_user_id_idx
  on public.library_items (user_id);

create index if not exists library_items_user_created_idx
  on public.library_items (user_id, created_at);

alter table public.library_items enable row level security;

create policy "Users can select own library items"
  on public.library_items
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own library items"
  on public.library_items
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own library items"
  on public.library_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own library items"
  on public.library_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.personalized_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  status text not null default 'pending',
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists personalized_analyses_user_video_uidx
  on public.personalized_analyses (user_id, video_id);

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

-- App writes via Drizzle (DATABASE_URL) only — same pattern as user_context.
revoke all on table public.videos from anon, authenticated;
revoke all on table public.video_transcripts from anon, authenticated;
revoke all on table public.library_items from anon, authenticated;
revoke all on table public.personalized_analyses from anon, authenticated;
