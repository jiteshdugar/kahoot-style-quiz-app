# AI Quiz Live

A Kahoot-style live quiz app. Hosts launch a quiz from an AI-themed template (up to 5 questions), players join with a game PIN, and the host watches answers arrive in real time.

**Stack:** Next.js (App Router) · Supabase (Postgres + Realtime) · deployable on Vercel.

## How it works
- Game state lives in Supabase Postgres. Browsers only read `games`/`players` and listen to Realtime.
- All writes go through Next.js route handlers (`app/api/**`) using the service-role key.
- Correct answers live in `game_questions`, which has no public policy, so they never reach players before the reveal.
- Live answers reach the host through Realtime Broadcast. Timers are timestamp-based (`question_ends_at`).

## Setup
1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the three values (the service-role key is server-only).
3. `npm install && npm run dev`, then open http://localhost:3000/host to host and http://localhost:3000 to join.
4. `npm test` runs the scoring and validation tests.

## Adding a template
Append an object to `data/templates.json` with exactly the same shape as the others (1-5 questions, 2-4 options each).

## Deploying to Vercel
Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables.
