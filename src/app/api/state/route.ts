import { NextResponse } from "next/server";
import { adminDb, publicUrl } from "@/lib/db";
import { currentPlayer } from "@/lib/session";

/**
 * Everything the feed screen needs in one poll: the meter, the roster, the
 * leaderboard and the latest captures.
 */
export async function GET() {
  const viewer = await currentPlayer();
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const db = adminDb();

  const [gameRes, playersRes, photosRes, shotsRes] = await Promise.all([
    db.from("game").select("*").eq("id", true).single(),
    db.from("players").select("id, name, emoji, is_target, reference_path").order("name"),
    db
      .from("photos")
      .select("*")
      .not("subject_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(60),
    db.from("shot_log").select("player_id, settled"),
  ]);

  const players = playersRes.data ?? [];
  const photos = photosRes.data ?? [];
  const shots = shotsRes.data ?? [];

  const byId = new Map(players.map((p) => [p.id, p]));

  const leaderboard = players
    .filter((p) => !p.is_target)
    .map((player) => {
      const own = photos.filter((photo) => photo.photographer_id === player.id);
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

  return NextResponse.json({
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
      url: publicUrl(photo.storage_path),
      caption: photo.caption,
      score: photo.score + photo.bounty_points,
      bountyPoints: photo.bounty_points,
      funniness: photo.funniness,
      candidness: photo.candidness,
      multiplier: Number(photo.stealth_multiplier),
      tags: photo.tags,
      createdAt: photo.created_at,
      photographer: byId.get(photo.photographer_id)?.name ?? "?",
      photographerEmoji: byId.get(photo.photographer_id)?.emoji ?? "📸",
      subject: byId.get(photo.subject_id!)?.name ?? "?",
      counterAttack: byId.get(photo.photographer_id)?.is_target ?? false,
    })),
  });
}
