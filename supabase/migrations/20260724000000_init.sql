-- ByeMatt schema. Run once against a fresh Supabase project.
--   supabase db push  (linked project)   OR   paste into the SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- storage --
-- Public bucket: these are photos of your own friends, and a public URL keeps
-- the feed fast without signing every image on every poll.
insert into storage.buckets (id, name, public)
values ('captures', 'captures', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- players --
-- Players register themselves: party code + a name creates the row, and the
-- reference selfie puts them on the roster. Nothing is seeded.
create table if not exists players (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  emoji          text not null default '🕵️',
  is_target      boolean not null default false, -- exactly one row: Matt
  -- Reference selfie, captured during enrolment. Every player needs one: the
  -- judge matches faces in each capture against this roster.
  reference_path text,
  enrolled_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- Case-insensitive names, so "Matt" and "matt" are the same person rather than
-- two rows fighting over the target flag.
create unique index if not exists players_name_lower
  on players (lower(name));

create unique index if not exists players_one_target
  on players ((is_target)) where is_target;

-- --------------------------------------------------------------- bounties --
-- An assignment the app hands out: "capture <subject> <action>". The rows
-- themselves are seeded in the next migration; this is just the shape.
create table if not exists bounties (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,                    -- "mid-bite", "dancing badly"
  points     int  not null default 30,
  -- Who must appear in the photo. NULL = whoever the current target is, so a
  -- hunter bounty stays valid without hard-coding Matt's id.
  subject_id uuid references players(id) on delete cascade,
  for_role   text not null default 'hunter'
             check (for_role in ('hunter', 'target')),
  claimed_by uuid references players(id) on delete set null,
  claimed_at timestamptz,
  photo_id   uuid
);

create index if not exists bounties_open_idx
  on bounties (for_role) where claimed_by is null;

-- ----------------------------------------------------------------- photos --
create table if not exists photos (
  id                 uuid primary key default gen_random_uuid(),
  photographer_id    uuid not null references players(id) on delete cascade,
  -- The player the judge identified as the point-scoring subject. NULL when
  -- nobody on the roster was recognised (the capture is then worth nothing).
  subject_id         uuid references players(id) on delete set null,
  -- Everyone the judge recognised, for the album and for "who was there" stats.
  detected_ids       uuid[] not null default '{}',
  storage_path       text not null,
  score              int  not null default 0,   -- points applied to the meter
  bounty_points      int  not null default 0,
  funniness          int  not null default 0,   -- 0-100, raw model rating
  candidness         int  not null default 0,   -- 0-100, how unaware they look
  stealth_multiplier numeric not null default 1,
  caption            text,
  tags               text[] not null default '{}',
  bounty_id          uuid references bounties(id) on delete set null,
  bounty_met         boolean not null default false,
  verified           boolean not null default true,
  rejected_reason    text,
  created_at         timestamptz not null default now()
);

create index if not exists photos_created_idx on photos (created_at desc);
create index if not exists photos_subject_idx on photos (subject_id, created_at desc);

-- ------------------------------------------------------------- game state --
create table if not exists game (
  id          boolean primary key default true check (id),
  meter       int not null default 0,
  threshold   int not null default 120,  -- points needed for the next shot
  shots_owed  int not null default 0,
  shots_taken int not null default 0,
  round       int not null default 1
);
insert into game (id) values (true) on conflict do nothing;

-- Every shot anyone owes, and why.
create table if not exists shot_log (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  photo_id   uuid references photos(id) on delete set null,
  reason     text not null,
  settled    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ meter logic --
-- Adds p_delta to the shared meter. Every time the meter crosses the current
-- threshold, Matt owes another shot and the threshold ratchets up, so the night
-- doesn't turn into a firehose. Negative deltas (Matt shooting back) claw the
-- meter down but never past zero.
create or replace function apply_points(p_delta int)
returns table (meter int, threshold int, shots_owed int, shots_added int)
language plpgsql
as $$
declare
  g     game%rowtype;
  added int := 0;
begin
  select * into g from game where id = true for update;

  g.meter := greatest(0, g.meter + p_delta);

  while g.meter >= g.threshold loop
    g.meter      := g.meter - g.threshold;
    g.shots_owed := g.shots_owed + 1;
    g.threshold  := g.threshold + 30;
    g.round      := g.round + 1;
    added        := added + 1;
  end loop;

  update game
     set meter = g.meter, threshold = g.threshold,
         shots_owed = g.shots_owed, round = g.round
   where id = true;

  meter := g.meter; threshold := g.threshold;
  shots_owed := g.shots_owed; shots_added := added;
  return next;
end;
$$;

-- Claims a bounty only if it is still open, so two players uploading the same
-- shot at once can't both bank it.
create or replace function claim_bounty(p_bounty uuid, p_player uuid, p_photo uuid)
returns boolean
language plpgsql
as $$
declare
  ok boolean;
begin
  update bounties
     set claimed_by = p_player, claimed_at = now(), photo_id = p_photo
   where id = p_bounty and claimed_by is null
  returning true into ok;

  return coalesce(ok, false);
end;
$$;

-- --------------------------------------------------------------- security --
-- Every write goes through a Next.js route handler using the service role key,
-- so the browser only ever gets read access with the anon key.
alter table players  enable row level security;
alter table photos   enable row level security;
alter table bounties enable row level security;
alter table game     enable row level security;
alter table shot_log enable row level security;

drop policy if exists read_photos   on photos;
drop policy if exists read_bounties on bounties;
drop policy if exists read_game     on game;
drop policy if exists read_shots    on shot_log;

create policy read_photos   on photos   for select using (true);
create policy read_bounties on bounties for select using (true);
create policy read_game     on game     for select using (true);
create policy read_shots    on shot_log for select using (true);

-- `players` stays locked down; the browser reads this view instead.
create or replace view public_players as
  select id, name, emoji, is_target, enrolled_at,
         reference_path is not null as enrolled
    from players;

-- Privileges. RLS bypass is not a grant: service_role still needs table-level
-- rights or every query 403s with "permission denied". Granting explicitly
-- rather than leaning on default privileges keeps local and hosted identical.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- The browser roles get reads only, and never see `players`.
grant select on photos, bounties, game, shot_log, public_players
  to anon, authenticated;

-- ------------------------------------------------------------------- seed --
-- No players are seeded — everyone registers themselves on the join screen.
-- Whoever signs in under TARGET_NAME (see .env) becomes the target.
--
-- No bounties either: the rigged jobs are seeded in the next migration.
