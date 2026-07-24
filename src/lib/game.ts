import { RULES } from "./config";
import { adminDb, type Player } from "./db";
import type { RosterEntry, Verdict } from "./score";

/**
 * Stealth multiplier. Rewards hunting a cold trail; damps a burst of photos
 * fired off in the same two minutes.
 */
export async function stealthMultiplier(subjectId: string): Promise<number> {
  const { data } = await adminDb()
    .from("photos")
    .select("created_at")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = data?.[0]?.created_at;
  if (!last) return RULES.COLD_TRAIL_MULTIPLIER; // first blood

  const minutes = (Date.now() - new Date(last).getTime()) / 60_000;
  if (minutes >= RULES.COLD_TRAIL_MINUTES) return RULES.COLD_TRAIL_MULTIPLIER;
  if (minutes < RULES.SPAM_WINDOW_MINUTES) return RULES.SPAM_MULTIPLIER;
  return 1;
}

/** Raw model verdict -> points on the board. */
export function pointsFor(verdict: Verdict, multiplier: number): number {
  const candidBonus = (verdict.candidness / 100) * RULES.CANDID_BONUS;
  const raw = (verdict.funniness + candidBonus) * multiplier * RULES.POINT_SCALE;
  return Math.max(1, Math.round(raw));
}

// ------------------------------------------------------------------ roster --

export type EnrolledPlayer = Player & { reference_path: string };

/** Everyone who has enrolled a reference selfie. */
export async function loadEnrolled(): Promise<EnrolledPlayer[]> {
  const { data } = await adminDb()
    .from("players")
    .select("id, name, emoji, is_target, reference_path")
    .not("reference_path", "is", null)
    .order("name");

  return (data ?? []) as EnrolledPlayer[];
}

// Reference images never change once enrolled, and re-downloading all of them
// on every capture adds a second to the upload spinner. Memoised per roster
// shape; a new enrolment changes the key and rebuilds.
let rosterCache: { key: string; entries: RosterEntry[] } | null = null;

/** Downloads each reference image and packs it for the judge. */
export async function buildRoster(
  players: EnrolledPlayer[],
): Promise<RosterEntry[]> {
  const key = players.map((p) => `${p.id}:${p.reference_path}`).sort().join("|");
  if (rosterCache?.key === key) return rosterCache.entries;

  const db = adminDb();

  const entries = await Promise.all(
    players.map(async (player) => {
      const path = player.reference_path.replace(/^captures\//, "");
      const { data, error } = await db.storage.from("captures").download(path);
      if (error || !data) return null;

      const buffer = Buffer.from(await data.arrayBuffer());
      return {
        name: player.name,
        image: {
          base64: buffer.toString("base64"),
          mediaType: data.type || "image/jpeg",
        },
      } satisfies RosterEntry;
    }),
  );

  const usable = entries.filter((entry): entry is RosterEntry => entry !== null);
  rosterCache = { key, entries: usable };
  return usable;
}

/** Maps the judge's names back to player rows, case-insensitively. */
export function matchNames(names: string[], roster: Player[]): Player[] {
  const byName = new Map(roster.map((p) => [p.name.toLowerCase(), p]));
  const seen = new Set<string>();
  const matched: Player[] = [];

  for (const name of names) {
    const player = byName.get(name.trim().toLowerCase());
    if (player && !seen.has(player.id)) {
      seen.add(player.id);
      matched.push(player);
    }
  }
  return matched;
}

// ------------------------------------------------------------------- meter --

export type MeterResult = {
  meter: number;
  threshold: number;
  shots_owed: number;
  shots_added: number;
};

/**
 * Applies points to the shared meter and records any shots that just came due.
 * A hunter's photo pushes the meter up; Matt shooting back pulls it down.
 */
export async function applyToMeter(opts: {
  delta: number;
  photoId: string;
  targetId: string;
  reason: string;
}): Promise<MeterResult> {
  const db = adminDb();

  const { data, error } = await db.rpc("apply_points", { p_delta: opts.delta });
  if (error) throw new Error(`apply_points failed: ${error.message}`);

  const result = (Array.isArray(data) ? data[0] : data) as MeterResult;

  if (result.shots_added > 0) {
    await db.from("shot_log").insert(
      Array.from({ length: result.shots_added }, () => ({
        player_id: opts.targetId,
        photo_id: opts.photoId,
        reason: opts.reason,
      })),
    );
  }

  return result;
}

/**
 * A rig landing puts shots on the target directly, without going through the
 * meter — no threshold ratchet, no waiting for the bar to fill. Pulling off a
 * setup the whole group worked on should pay out the moment it's judged.
 */
export async function oweShots(opts: {
  count: number;
  playerId: string;
  photoId: string;
  reason: string;
}): Promise<number> {
  const db = adminDb();

  const { data, error } = await db.rpc("owe_shots", { p_count: opts.count });
  if (error) throw new Error(`owe_shots failed: ${error.message}`);

  await db.from("shot_log").insert(
    Array.from({ length: opts.count }, () => ({
      player_id: opts.playerId,
      photo_id: opts.photoId,
      reason: opts.reason,
    })),
  );

  return typeof data === "number" ? data : 0;
}

/** Matt's revenge: whoever he catches owes one immediately. */
export async function chargeSubject(opts: {
  playerId: string;
  photoId: string;
  reason: string;
}): Promise<void> {
  await adminDb().from("shot_log").insert({
    player_id: opts.playerId,
    photo_id: opts.photoId,
    reason: opts.reason,
  });
}

// ---------------------------------------------------------------- bounties --

export type Bounty = {
  id: string;
  /** Caper name — "The Touchdown". */
  title: string | null;
  /** The configuration the photo has to show, graded clause by clause. */
  action: string;
  points: number;
  /** Shots straight onto the target's tab when this is claimed. 0 = points only. */
  shots: number;
  subject_id: string | null;
  for_role: "hunter" | "target";
  claimed_by: string | null;
};

/**
 * Open rigs for this player's side of the game. Every seeded rig is aimed at
 * Matt, so the target's side comes back empty — which is exactly right: he
 * should never see the list of things he's about to be tricked into doing.
 */
export async function openBounties(player: Player): Promise<Bounty[]> {
  const { data } = await adminDb()
    .from("bounties")
    .select("id, title, action, points, shots, subject_id, for_role, claimed_by")
    .eq("for_role", player.is_target ? "target" : "hunter")
    .is("claimed_by", null)
    .order("points", { ascending: false });

  return (data ?? []) as Bounty[];
}

/**
 * Atomically claims a bounty. Returns false if someone else banked it first,
 * which matters when two people photograph the same moment.
 */
export async function claimBounty(opts: {
  bountyId: string;
  playerId: string;
  photoId: string;
}): Promise<boolean> {
  const { data, error } = await adminDb().rpc("claim_bounty", {
    p_bounty: opts.bountyId,
    p_player: opts.playerId,
    p_photo: opts.photoId,
  });

  if (error) return false;
  return data === true;
}
