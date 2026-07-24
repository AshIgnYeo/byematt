import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { openBounties } from "@/lib/game";
import { currentPlayer } from "@/lib/session";

/** The rigs still open to whoever is asking. Empty list for Matt, by design. */
export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const bounties = await openBounties(player);

  const { data: names } = await adminDb()
    .from("players")
    .select("id, name, emoji, is_target");

  const byId = new Map((names ?? []).map((p) => [p.id, p]));
  const target = (names ?? []).find((p) => p.is_target);

  return NextResponse.json({
    bounties: bounties.map((bounty) => {
      const subject = byId.get(bounty.subject_id ?? target?.id ?? "");
      return {
        id: bounty.id,
        title: bounty.title,
        action: bounty.action,
        points: bounty.points,
        shots: bounty.shots,
        subjectName: subject?.name ?? "someone",
        subjectEmoji: subject?.emoji ?? "🎯",
      };
    }),
  });
}
