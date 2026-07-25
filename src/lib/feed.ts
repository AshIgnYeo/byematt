import { adminDb, publicUrl, type Player } from "./db";

/**
 * The read models behind the feed and the reckoning.
 *
 * They live here rather than inside the route handlers because both screens
 * need them twice: once on the server, to render the tab with its data already
 * in it, and again from the client poll that keeps it fresh. Same shape both
 * ways, so the client can seed its state from the server render and skip the
 * round trip it used to make on mount.
 */

/** Only the photo columns the feed actually paints. `select("*")` dragged the
 *  whole row — detected_ids, bounty_id, verified — over the wire for nothing.
 *  Kept on one line: supabase-js reads the literal to type the result. */
const FEED_COLUMNS =
  "id, photographer_id, subject_id, storage_path, thumb_path, width, height, score, bounty_points, bounty_met, funniness, candidness, stealth_multiplier, caption, tags, rejected_reason, created_at";

export type FeedPhoto = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string;
  counted: boolean;
  reason: string | null;
  score: number;
  bountyPoints: number;
  funniness: number;
  candidness: number;
  multiplier: number;
  tags: string[];
  createdAt: string;
  photographer: string;
  photographerEmoji: string;
  subject: string | null;
  counterAttack: boolean;
};

export type FeedState = {
  viewer: { id: string; name: string; isTarget: boolean };
  game: {
    meter: number;
    threshold: number;
    shots_owed: number;
    round: number;
  } | null;
  roster: {
    id: string;
    name: string;
    emoji: string;
    isTarget: boolean;
    enrolled: boolean;
  }[];
  leaderboard: {
    id: string;
    name: string;
    emoji: string;
    points: number;
    captures: number;
    bounties: number;
    owes: number;
    enrolled: boolean;
  }[];
  feed: FeedPhoto[];
};

export type ShotsState = {
  shots: {
    id: string;
    settled: boolean;
    reason: string;
    createdAt: string;
    player: string;
    emoji: string;
  }[];
  hallOfFame: {
    id: string;
    url: string;
    width: number | null;
    height: number | null;
    caption: string;
    score: number;
  }[];
};

/** The feed-sized copy, falling back to the original for pre-thumbnail photos. */
function imageUrl(photo: { storage_path: string; thumb_path: string | null }) {
  return publicUrl(photo.thumb_path ?? photo.storage_path);
}

/** Everything the feed screen needs: the meter, the roster, the leaderboard
 *  and the latest captures. */
export async function loadState(viewer: Player): Promise<FeedState> {
  const db = adminDb();

  const [gameRes, playersRes, photosRes, shotsRes] = await Promise.all([
    db.from("game").select("meter, threshold, shots_owed, round").eq("id", true).single(),
    db.from("players").select("id, name, emoji, is_target, reference_path").order("name"),
    // Misses come back too. They score nothing, but a photo of the six of you
    // failing to find Matt is still a photo of the night.
    db.from("photos").select(FEED_COLUMNS).order("created_at", { ascending: false }).limit(60),
    db.from("shot_log").select("player_id, settled"),
  ]);

  const players = playersRes.data ?? [];
  const photos = photosRes.data ?? [];
  const shots = shotsRes.data ?? [];

  const byId = new Map(players.map((p) => [p.id, p]));

  const leaderboard = players
    .filter((p) => !p.is_target)
    .map((player) => {
      // Only captures that landed on somebody count toward the standings.
      const own = photos.filter(
        (photo) => photo.photographer_id === player.id && photo.subject_id,
      );
      return {
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        enrolled: player.reference_path !== null,
        captures: own.length,
        points: own.reduce((sum, p) => sum + p.score + p.bounty_points, 0),
        bounties: own.filter((p) => p.bounty_met).length,
        owes: shots.filter((s) => s.player_id === player.id && !s.settled).length,
      };
    })
    .sort((a, b) => b.points - a.points);

  return {
    viewer: { id: viewer.id, name: viewer.name, isTarget: viewer.is_target },
    game: gameRes.data,
    roster: players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      isTarget: p.is_target,
      enrolled: p.reference_path !== null,
    })),
    leaderboard,
    feed: photos.map((photo) => ({
      id: photo.id,
      url: imageUrl(photo),
      width: photo.width,
      height: photo.height,
      caption: photo.caption,
      counted: photo.subject_id !== null,
      reason: photo.rejected_reason,
      score: photo.score + photo.bounty_points,
      bountyPoints: photo.bounty_points,
      funniness: photo.funniness,
      candidness: photo.candidness,
      multiplier: Number(photo.stealth_multiplier),
      tags: photo.tags,
      createdAt: photo.created_at,
      photographer: byId.get(photo.photographer_id)?.name ?? "?",
      photographerEmoji: byId.get(photo.photographer_id)?.emoji ?? "📸",
      subject: photo.subject_id ? byId.get(photo.subject_id)?.name ?? "?" : null,
      counterAttack: byId.get(photo.photographer_id)?.is_target ?? false,
    })),
  };
}

export type AlbumPhoto = {
  id: string;
  url: string;
  full: string;
  width: number | null;
  height: number | null;
  caption: string;
  counted: boolean;
  score: number;
  createdAt: string;
  photographer: string;
  photographerEmoji: string;
  subject: string | null;
};

export type AlbumState = {
  count: number;
  photos: AlbumPhoto[];
};

/** Every picture from the night, newest first — the hits and the misses both.
 *  The feed rations itself to the latest 60; the album is the whole roll. */
export async function loadAlbum(): Promise<AlbumState> {
  const db = adminDb();

  const [playersRes, photosRes] = await Promise.all([
    db.from("players").select("id, name, emoji"),
    db
      .from("photos")
      .select(
        "id, photographer_id, subject_id, storage_path, thumb_path, width, height, score, bounty_points, caption, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const byId = new Map((playersRes.data ?? []).map((p) => [p.id, p]));
  const photos = photosRes.data ?? [];

  return {
    count: photos.length,
    photos: photos.map((photo) => ({
      id: photo.id,
      url: imageUrl(photo),
      full: publicUrl(photo.storage_path),
      width: photo.width,
      height: photo.height,
      caption: photo.caption ?? "",
      counted: photo.subject_id !== null,
      score: photo.score + photo.bounty_points,
      createdAt: photo.created_at,
      photographer: byId.get(photo.photographer_id)?.name ?? "?",
      photographerEmoji: byId.get(photo.photographer_id)?.emoji ?? "📸",
      subject: photo.subject_id ? byId.get(photo.subject_id)?.name ?? "?" : null,
    })),
  };
}

/** Outstanding shots, newest first, with the photo that caused each one. */
export async function loadShots(): Promise<ShotsState> {
  const db = adminDb();

  const [shotsRes, playersRes, photosRes] = await Promise.all([
    db
      .from("shot_log")
      .select("id, player_id, reason, settled, created_at")
      .order("created_at", { ascending: false }),
    db.from("players").select("id, name, emoji"),
    db
      .from("photos")
      .select("id, storage_path, thumb_path, width, height, caption, score, bounty_points")
      .not("subject_id", "is", null)
      .order("score", { ascending: false })
      .limit(5),
  ]);

  const byId = new Map((playersRes.data ?? []).map((p) => [p.id, p]));

  return {
    shots: (shotsRes.data ?? []).map((shot) => ({
      id: shot.id,
      settled: shot.settled,
      reason: shot.reason,
      createdAt: shot.created_at,
      player: byId.get(shot.player_id)?.name ?? "?",
      emoji: byId.get(shot.player_id)?.emoji ?? "🥃",
    })),
    hallOfFame: (photosRes.data ?? []).map((photo) => ({
      id: photo.id,
      url: imageUrl(photo),
      width: photo.width,
      height: photo.height,
      caption: photo.caption,
      score: photo.score + photo.bounty_points,
    })),
  };
}
