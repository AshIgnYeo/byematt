import { NextResponse } from "next/server";
import { loadAlbum } from "@/lib/feed";
import { currentPlayer } from "@/lib/session";

/**
 * The album's polling endpoint. First paint comes from the server render;
 * this only folds in whatever's landed since.
 */
export async function GET() {
  const viewer = await currentPlayer();
  if (!viewer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(await loadAlbum());
}
