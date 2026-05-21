# Darkade / Murderland Arcade

A static browser arcade game built with HTML, CSS, JavaScript, Netlify Functions, and Supabase. Clear waves, fight bosses, collect powerups, and chase the global leaderboard.

## Run Locally

Open `index.html` in a browser for offline play, or use the Netlify CLI to test the global leaderboard functions locally:

```sh
netlify dev
```

## Deploy

This project is ready for Netlify as a static site:

- Publish directory: repository root
- Build command: none
- Functions directory: `netlify/functions`

Set these Netlify environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon public API key

Do not use the Supabase service role key in frontend code or Netlify Function code for this public leaderboard. Access is controlled by the RLS policies below.

## Supabase

Create a `scores` table in Supabase using `supabase/schema.sql`, or run:

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  wave integer not null,
  created_at timestamp with time zone not null default now()
);

create index scores_leaderboard_idx
  on public.scores (score desc, wave desc, created_at asc);

alter table public.scores enable row level security;

create policy "scores_select_public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

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
```

The Netlify Functions sanitize player names before insert:

- max 12 characters
- uppercase display
- only letters, numbers, spaces, dash, and underscore
- scores below `0` or above `9999999` are rejected by the submit endpoint

The browser keeps the localStorage leaderboard as an offline fallback. On game over it saves locally first, then submits to `/.netlify/functions/submit-score` when the API is available. The start and game over leaderboard views read the global top 10 from `/.netlify/functions/get-scores`.

If different devices show different scores, check the browser console for fallback messages and verify the deployed Netlify site has the required environment variables. The functions use the anon key server-side; the RLS policies above permit public reads and constrained public inserts for the `scores` table.

## Files

- `index.html` - Game markup and SEO metadata
- `style.css` - Responsive arcade UI styling
- `game.js` - Canvas game logic and controls
- `netlify/functions/get-scores.js` - Global leaderboard read endpoint
- `netlify/functions/submit-score.js` - Global leaderboard submit endpoint
- `supabase/schema.sql` - Supabase leaderboard table schema
