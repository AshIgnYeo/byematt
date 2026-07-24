import { NextResponse } from "next/server";
import { adminDb, publicUrl } from "@/lib/db";
import { currentPlayer } from "@/lib/session";

/** Outstanding shots, newest first, with the photo that caused each one. */
export async function GET() {
  const viewer = await currentPlayer();
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const db = adminDb();

  const [shotsRes, playersRes, photosRes] = await Promise.all([
    db.from("shot_log").select("*").order("created_at", { ascending: false }),
    db.from("players").select("id, name, emoji"),
    db
      .from("photos")
      .select("id, storage_path, caption, score, bounty_points, funniness")
      .not("subject_id", "is", null)
      .order("score", { ascending: false })
      .limit(5),
  ]);

  const byId = new Map((playersRes.data ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
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
      url: publicUrl(photo.storage_path),
      caption: photo.caption,
      score: photo.score + photo.bounty_points,
    })),
  });
}

/** Mark a shot as actually taken. */
export async function POST(request: Request) {
  const viewer = await currentPlayer();
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { shotId } = await request.json();
  const db = adminDb();

  const { data: shot } = await db
    .from("shot_log")
    .update({ settled: true })
    .eq("id", shotId)
    .eq("settled", false)
    .select("player_id")
    .single();

  // The game counter tracks the target's tally specifically.
  if (shot) {
    const { data: target } = await db
      .from("players")
      .select("id")
      .eq("is_target", true)
      .single();

    if (target && shot.player_id === target.id) {
      const { data: game } = await db
        .from("game")
        .select("shots_owed, shots_taken")
        .eq("id", true)
        .single();

      if (game) {
        await db
          .from("game")
          .update({
            shots_owed: Math.max(0, game.shots_owed - 1),
            shots_taken: game.shots_taken + 1,
          })
          .eq("id", true);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
