import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { currentPlayer } from "@/lib/session";

/**
 * Stores the browser's push subscription against the signed-in player.
 *
 * The client re-posts its existing subscription on every load, so this is an
 * upsert: it re-points an endpoint at whoever is signed in now (phones get
 * handed around) and quietly heals the table after a `supabase db reset`.
 */
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json({ error: "Malformed subscription." }, { status: 400 });
  }

  const { error } = await adminDb()
    .from("push_subscriptions")
    .upsert(
      { endpoint, player_id: player.id, p256dh, auth },
      { onConflict: "endpoint" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Turning alerts off. The browser has already dropped its end by now. */
export async function DELETE(request: Request) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ error: "No endpoint given." }, { status: 400 });
  }

  await adminDb().from("push_subscriptions").delete().eq("endpoint", body.endpoint);

  return NextResponse.json({ ok: true });
}
