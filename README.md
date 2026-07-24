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
4. **Rigged jobs.** Six standing assignments, and the reason to talk to each
   other. Each one names an exact configuration — *both arms above his head and
   his mouth open*, *three fingers on one hand and four on the other* — and says
   nothing whatsoever about how to get him there. That half is the game. Arm one
   before you shoot; land it and Matt drinks immediately, no meter involved.
   Each job pays out once, to whoever banks it first.
5. **The reckoning.** Outstanding shots, and the five photos that did the most
   damage, ready to play back at the end of the night.

## Scoring

```
points = (funniness + candidness/100 × 40) × stealth × 0.5   [+ bounty bonus]
```

`stealth` is ×1.5 if nobody has caught the subject in the last 10 minutes
(rewards actually hunting), ×0.6 if someone did in the last 2 (stops burst
spamming). All of it is tunable in `src/lib/config.ts`.

Rigs score badly on candidness by definition — he's posing, that was the plan —
so their base points are small and the bounty bonus plus the instant shot is the
whole payoff. The judge is told not to hold the posing against a rig, and to
grade the description as a checklist where every clause has to be visibly true,
counting fingers and hands and people literally. That strictness is what stops
an argument at 1am, so keep new jobs countable from a single frame. The seeds
live in `supabase/migrations/20260724010000_rigs.sql`; `shots` is how many land
the moment it's claimed, `0` for points only.

## Alerts

The app installs to the home screen and buzzes everyone twice: when a capture
lands, with the roast as the notification body and the photo attached, and when
the meter tips Matt into another drink. The photographer is left out of the
first one — they're already looking at the verdict — and nobody is left out of
the second, which is the gather-round moment.

Two things gate this, and both bite:

- **HTTPS.** Push needs a secure origin. `localhost` counts; `http://192.168.…`
  does not, so alerts are dead on the LAN-over-wifi setup below.
- **Home screen, on iPhone.** iOS only delivers push to a web app that was added
  via Share → Add to Home Screen, and only from iOS 16.4. Opening the URL in
  Safari won't do it. The feed says so if it detects that case.

### Getting them installed

The join screen nudges people before they sign in. A page can't install itself —
there is no link for it — so it does the two things that are actually possible:
fires Chromium's `beforeinstallprompt` from a real **Install** button on Android,
and prints the Share → Add to Home Screen steps on an iPhone.

The nudge sits *above* the form deliberately. An iOS home-screen app gets its own
cookie jar, so anyone who joins in Safari and installs afterwards signs in twice.

Two ways this goes wrong when you paste the link into the group chat:

- **Chat-app browsers.** A link opened inside WhatsApp, Instagram or Messenger
  runs in an embedded browser that can't install anything. The iPhone copy says
  to reopen in Safari; on Android it's ⋮ → *Open in Chrome*.
- **Chrome's timing.** `beforeinstallprompt` only fires once Chrome decides the
  visitor is engaged, so the Install button can take a beat to appear. Chrome's
  ⋮ → *Install app* is always there as the fallback.

Set the VAPID keypair — how the push services know the alerts came from your
server — and it's on:

```bash
pnpm vapid    # prints a public/private pair for .env.local
```

Leave those blank and everything else plays as before, silently. Don't rotate
them mid-party: every phone is subscribed to the old public key and goes quiet
until it re-subscribes.

Each broadcast logs a `[push]` line with how many went out and how many dead
endpoints were pruned. Endpoints die on their own — reinstalls, cleared site
data — and are dropped on the 404/410 the push service returns.

## Setup

```bash
pnpm install
```

The schema lives in `supabase/migrations/`. It creates the tables, the
`captures` storage bucket, the meter functions, and seeds the six rigged jobs.
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

### Deploying

Anywhere that runs Next 15 works; the app is stateless apart from Supabase. On
Vercel it's the repo plus every variable from `.env.example` in project settings
— including both VAPID keys, or the alerts silently never arrive. `/api/capture`
sets `maxDuration = 60`, because the upload and the judging call share a single
request; that fits inside Hobby's ceiling either way — 300s with fluid compute
on, 60s exactly with it off.

HTTPS comes free there, which is the part that matters: it's what makes the app
installable and push possible at all.

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
so there's nothing else to set up for the game itself. Notifications are the
exception: they need HTTPS, so test those against the deployed URL.

## The night of

- Get everyone through `/enroll` **before** the drinking starts. Reference
  photos taken at midnight in a dark bar will not match well.
- Same trip, same moment: have everyone add the app to their home screen and hit
  **Alerts on** on the feed. On iPhone it has to be the home-screen copy, and
  nobody will do it later.
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
- The service worker has no cache and no fetch handler. Every screen is a live
  poll of a game happening in the same room, so a stale cached feed would be
  worse than none; it exists purely to receive push and to make the app
  installable.
- Notifications go out from `after()`, once the capture response is already on
  its way back. A fan-out to eight phones should never sit inside the upload
  spinner, and a push service having a bad night must never fail a capture.
