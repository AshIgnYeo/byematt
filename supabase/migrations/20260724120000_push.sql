-- Web push subscriptions: one row per browser that opted in.
--
-- A push subscription belongs to a browser, not a person — the same phone
-- signed in as someone else keeps the same endpoint — so the endpoint is the
-- primary key and re-subscribing just moves it to whoever is signed in now.

create table if not exists push_subscriptions (
  endpoint   text primary key,
  player_id  uuid not null references players(id) on delete cascade,
  -- The browser's public key and auth secret. web-push encrypts every payload
  -- to these, so the push service itself never sees the caption.
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_player_idx
  on push_subscriptions (player_id);

-- Nothing here is public: subscriptions are write-and-send, only ever touched
-- by route handlers holding the service-role key. No read policy, so the anon
-- key sees an empty table.
alter table push_subscriptions enable row level security;

-- The blanket grant in the init migration only covered tables that existed
-- then, so this one needs its own.
grant all on push_subscriptions to service_role;
