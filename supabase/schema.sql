create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  wave integer not null,
  created_at timestamptz not null default now()
);

create index if not exists scores_leaderboard_idx
  on public.scores (score desc, wave desc, created_at asc);
