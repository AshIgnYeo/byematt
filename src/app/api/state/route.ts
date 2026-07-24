import { NextResponse } from "next/server";
import { loadState } from "@/lib/feed";
import { currentPlayer } from "@/lib/session";

/**
 * The feed's polling endpoint. The first paint comes from the server render;
 * this only keeps it moving.
 */
export async function GET() {
  const viewer = await currentPlayer();
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(await loadState(viewer));
}
