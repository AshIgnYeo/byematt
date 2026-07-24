import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { dealCounterBounties, openBounties } from "@/lib/game";
import { currentPlayer } from "@/lib/session";

/** The assignments currently open to whoever is asking. */
export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Keep Matt's deck topped up; his assignments name real people, so they can
  // only be generated once the roster exists.
  if (player.is_target) await dealCounterBounties();

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
        action: bounty.action,
        points: bounty.points,
        subjectName: subject?.name ?? "someone",
        subjectEmoji: subject?.emoji ?? "🎯",
      };
    }),
  });
}
