-- Rigged jobs. Every bounty in the game is one of these: not "wait for Matt to
-- yawn" but an exact configuration he will never fall into on his own. Getting
-- him there is the game — the app deliberately says nothing about how, because
-- the scheming is the fun part and six people in a bar will out-invent any list
-- we could write.
--
-- They're staged, so they score badly on candidness. That's fine: the payoff
-- isn't points, it's shots straight onto Matt's tab.

-- Caper name, the headline on the card.
alter table bounties add column if not exists title text;

-- Shots that land on the target the moment this is claimed, bypassing the
-- meter entirely.
alter table bounties add column if not exists shots int not null default 0;

-- Puts shots on the tab without touching the meter. `apply_points` ratchets the
-- threshold every time it fires; a rig shouldn't make the next one harder.
create or replace function owe_shots(p_count int)
returns int
language plpgsql
as $$
declare
  owed int;
begin
  update game set shots_owed = shots_owed + p_count
   where id = true
  returning shots_owed into owed;

  return owed;
end;
$$;

grant execute on function owe_shots(int) to service_role;

-- ------------------------------------------------------------------- seed --
-- Conditions are written as checklists on purpose: the judge is told every
-- clause must be visibly true, so "both arms up AND mouth open" can't be half
-- satisfied. Anything countable — fingers, hands, people — is countable from a
-- single frame, which is the whole test for whether a rig belongs on this list.
-- Six of them, each a different shape of caper, so no two nights run the same.
insert into bounties (title, action, points, shots, for_role, subject_id)
select v.title, v.action, v.points, v.shots, 'hunter', null
from (values
  ('The Full House',
   'in a photo with four or more people, and the only one not looking at the camera',
   90, 2),

  ('Three and Four',
   'holding up three fingers on one hand and four on the other, both hands visible',
   70, 1),

  ('The Chorus',
   'eyes shut, mouth open mid-lyric, with one arm around somebody',
   65, 1),

  ('The Touchdown',
   'with both arms straight up above his head and his mouth wide open',
   60, 1),

  ('The Deal',
   'mid-handshake with someone who is not in the party, both of them looking at each other',
   60, 1),

  ('Double Fisted',
   'holding a drink in each hand with both raised to his mouth at once, actually drinking from them',
   55, 1)
) as v(title, action, points, shots)
where not exists (select 1 from bounties);
