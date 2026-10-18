-- Kahoot-style quiz schema. All writes go through Next.js route handlers (service role).
-- Browsers only SELECT games/players (RLS) and listen to Realtime.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  pin text not null unique,
  title text not null,
  state text not null default 'lobby' check (state in ('lobby','question','reveal','finished')),
  q_index int not null default -1,
  total_questions int not null check (total_questions between 1 and 5),
  question_ends_at timestamptz,
  public_question jsonb,   -- {idx,text,options,seconds}; never contains the correct answer
  reveal jsonb,            -- {correct,counts}; set only when the host reveals
  created_at timestamptz not null default now()
);

-- Kept out of `games` so the host token is never readable by anon (or via Realtime).
create table public.game_secrets (
  game_id uuid primary key references public.games(id) on delete cascade,
  host_token text not null
);

create table public.game_questions (
  game_id uuid not null references public.games(id) on delete cascade,
  idx int not null,
  text text not null,
  options jsonb not null,
  correct int not null,
  seconds int not null default 20,
  primary key (game_id, idx)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  score int not null default 0,
  created_at timestamptz not null default now()
);
create unique index players_game_name_uq on public.players (game_id, lower(name));

create table public.answers (
  game_id uuid not null references public.games(id) on delete cascade,
  q_idx int not null,
  player_id uuid not null references public.players(id) on delete cascade,
  choice int not null,
  is_correct boolean not null,
  points int not null default 0,
  answered_at timestamptz not null default now(),
  primary key (game_id, q_idx, player_id)   -- blocks double answers
);

alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_questions enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;

-- Only these two are readable by browsers. Everything else: no policies = service role only.
create policy "games readable" on public.games for select to anon, authenticated using (true);
create policy "players readable" on public.players for select to anon, authenticated using (true);

create or replace function public.add_score(p_player uuid, p_points int)
returns void language sql security definer set search_path = public as $$
  update public.players set score = score + p_points where id = p_player;
$$;
revoke all on function public.add_score(uuid, int) from public, anon, authenticated;
grant execute on function public.add_score(uuid, int) to service_role;

alter publication supabase_realtime add table public.games, public.players;
alter table public.players replica identity full;
