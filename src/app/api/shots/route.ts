import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { loadShots } from "@/lib/feed";
import { currentPlayer } from "@/lib/session";

/**
 * The reckoning's polling endpoint. The first paint comes from the server
 * render; this only keeps it moving.
 */
export async function GET() {
  const viewer = await currentPlayer();
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(await loadShots());
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
