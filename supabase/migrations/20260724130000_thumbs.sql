-- ----------------------------------------------------------- feed thumbs --
-- The wire holds sixty photos. Serving the full 1600px copy for each one meant
-- a phone pulling ~18MB to scroll the night back, so every capture now stores a
-- 640px copy alongside it and the feed reads that instead.
--
-- Nullable on purpose: photos taken before this fall back to storage_path, so
-- the migration needs no backfill.
alter table photos add column if not exists thumb_path text;

-- The full copy's dimensions, so the feed can reserve each row's height rather
-- than reflowing the whole list as images arrive.
alter table photos add column if not exists width  int;
alter table photos add column if not exists height int;
