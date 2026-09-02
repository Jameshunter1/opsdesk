-- OpsDesk cloud schema — paste this whole file into your Supabase
-- project's SQL Editor and press Run. One table: each user gets exactly
-- one row holding their whole workspace document, and Row Level Security
-- guarantees users can only ever touch their own row.

create table if not exists public.workspaces (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  doc        jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "read own workspace"
  on public.workspaces for select
  using (auth.uid() = user_id);

create policy "create own workspace"
  on public.workspaces for insert
  with check (auth.uid() = user_id);

create policy "update own workspace"
  on public.workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own workspace"
  on public.workspaces for delete
  using (auth.uid() = user_id);
