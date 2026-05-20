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
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key, stored only in Netlify

Do not put the Supabase service role key in frontend code.

## Supabase

Create a `scores` table in Supabase using `supabase/schema.sql`, or run:

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  wave integer not null,
  created_at timestamptz not null default now()
);

create index scores_leaderboard_idx
  on public.scores (score desc, wave desc, created_at asc);
```

The Netlify Functions sanitize player names before insert:

- max 12 characters
- uppercase display
- only letters, numbers, spaces, dash, and underscore
- scores below `0` or above `9999999` are rejected by the submit endpoint

The browser keeps the localStorage leaderboard as an offline fallback. On game over it saves locally first, then submits to `/.netlify/functions/submit-score` when the API is available. The start and game over leaderboard views read the global top 10 from `/.netlify/functions/get-scores`.

## Files

- `index.html` - Game markup and SEO metadata
- `style.css` - Responsive arcade UI styling
- `game.js` - Canvas game logic and controls
- `netlify/functions/get-scores.js` - Global leaderboard read endpoint
- `netlify/functions/submit-score.js` - Global leaderboard submit endpoint
- `supabase/schema.sql` - Supabase leaderboard table schema
