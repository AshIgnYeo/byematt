# ByeMatt

A bachelor-party paparazzi game. Everyone sneaks photos of Matt without him
noticing. Claude judges each one for how funny and how *candid* it is, points go
to the photographer, and shots go to Matt.

Matt has an account too. He can shoot back — every hunter he catches off guard
pulls his meter down, and that person drinks for getting caught.

## How it plays

1. **Roll call.** Everyone signs in with the party code and whatever they want
   to be called, then takes one clear reference selfie. That puts them on the
   roster — there's no preset list to maintain.

   The groom presses **Sign in as Matt** instead of typing a name. That's the
   only way to become the target, so nothing depends on him spelling anything
   correctly. Press it again later and he signs back into the same account.

   The roster is what makes the rest work: the judge matches faces in every
   capture against it, so nobody declares who's in a photo and nobody scores off
   a stranger.
2. **The hunt.** Snap Matt, upload. Claude identifies who's in frame, rates
   funniness and candidness 0–100, and writes a one-line roast.
3. **The shot meter.** One shared bar. Hunter points push it up; Matt's
   counter-attacks pull it down. Cross the threshold → Matt drinks, the meter
   resets, and the threshold ratchets up so the night doesn't run away.
4. **Assignments.** The app hands out bounties — "catch Matt mid-bite",
   "catch Sherman mid-yawn". Arm one before you shoot; the judge decides
   strictly whether you actually nailed it. Bonus points if you did.
5. **The reckoning.** Outstanding shots, and the five photos that did the most
   damage, ready to play back at the end of the night.

## Scoring

```
points = (funniness + candidness/100 × 40) × stealth × 0.5   [+ bounty bonus]
```

`stealth` is ×1.5 if nobody has caught the subject in the last 10 minutes
(rewards actually hunting), ×0.6 if someone did in the last 2 (stops burst
spamming). All of it is tunable in `src/lib/config.ts`.

## Setup

```bash
pnpm install
```

The schema lives in `supabase/migrations/`. It creates the tables, the
`captures` storage bucket, the meter function, and seeds the hunter bounties.
No players are seeded — everyone registers themselves on the join screen, so
there's nothing to configure beyond `.env.local`.

### Local (Docker)

```bash
supabase start          # first run pulls a few GB
supabase db reset       # applies the migration + seed
cp .env.example .env.local
```

`supabase start` prints the local API URL and the anon/service-role keys — paste
those into `.env.local`. You still need a real `ANTHROPIC_API_KEY`; scoring is
the one thing that can't run locally.

To wipe the game and start over: `supabase db reset`.

### Hosted

```bash
supabase link --project-ref <ref>
supabase db push
```

Then take the URL and keys from the project's API settings.

**Anthropic.** Any API key with Opus access. Scoring runs on `claude-opus-4-8`
at `effort: "low"` with thinking off — this is a perception call behind an
upload spinner, so latency beats depth.

The roster reference images sit behind a cache breakpoint. Measured on a
two-person roster: 3,390 cached tokens + 1,152 fresh + ~78 out per photo, about
**0.9¢**. Extrapolating to eight people, roughly **1.5¢ per photo** — against
~7¢ if the roster weren't cached.

Each capture logs a `[score]` line with its token split. If `cached=0` shows up
on consecutive photos, something is invalidating the prefix and the bill is
about to be 5× larger than it should be.

```bash
pnpm dev     # http://localhost:5050
```

To test on a phone, put it on the same wifi and open `http://<your-lan-ip>:5050`
— `pnpm dev` prints the address as *Network*. The camera works over plain HTTP,
so there's nothing else to set up.

## The night of

- Get everyone through `/enroll` **before** the drinking starts. Reference
  photos taken at midnight in a dark bar will not match well.
- Read the captions out loud. That's most of the fun.
- `/reckoning` is the screen to have open when you're calling shots.
- Signing in is the shared party code plus your name — no per-player secret.
  Anyone with the code can sign in as anyone, including as Matt. Fine for one
  night among friends; don't reuse this for anything real.

## Notes

- Every write goes through a route handler with the service-role key; the
  browser never talks to Supabase directly.
- Photos are downscaled to 1600px in the browser before upload. Opus 4.8 reads
  up to 2576px, so anything larger is paid for and thrown away.
- If the judge can't find Matt in a photo, it's saved to the album but scores
  nothing, with the reason shown.
