create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  wave integer not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists scores_leaderboard_idx
  on public.scores (score desc, wave desc, created_at asc);

alter table public.scores enable row level security;

drop policy if exists "scores_select_public" on public.scores;
create policy "scores_select_public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists "scores_insert_public" on public.scores;
create policy "scores_insert_public"
  on public.scores
  for insert
  to anon, authenticated
  with check (
    length(name) between 1 and 12
    and name ~ '^[A-Z0-9 _-]+$'
    and score between 0 and 9999999
    and wave >= 1
  );
