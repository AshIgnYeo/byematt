import { NextResponse } from "next/server";
import { SESSION_COOKIE, STORAGE_BUCKET } from "@/lib/config";
import { adminDb } from "@/lib/db";
import { currentPlayer } from "@/lib/session";

/**
 * Deletes the profile you are signed in as, and signs you out.
 *
 * Self-service is the whole permission model, and it covers both ways roll call
 * goes wrong: pressing "Sign in as Matt" by mistake, or Matt typing his name
 * into the form. Either way the person who made the mistake is holding that
 * session, so nothing more than being signed in is needed to undo it — and
 * nobody can delete anyone else.
 *
 * A profile abandoned earlier is still reachable: sign back into it (the button
 * for the target, the same name for a hunter), then delete it.
 */
export async function POST() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const db = adminDb();

  // Storage has no foreign keys, so the row cascade below would leave these
  // orphaned. Clear them first: a failure here is not worth blocking on, since
  // the profile going away is the point.
  const objects: string[] = [];
  if (player.reference_path) {
    objects.push(player.reference_path.replace(`${STORAGE_BUCKET}/`, ""));
  }

  const { data: shots } = await db.storage
    .from(STORAGE_BUCKET)
    .list(`shots/${player.id}`);

  for (const shot of shots ?? []) objects.push(`shots/${player.id}/${shot.name}`);
  if (objects.length > 0) {
    await db.storage.from(STORAGE_BUCKET).remove(objects);
  }

  // Cascades do the rest: their photos and shot_log entries go, bounties they
  // claimed reopen, and photos where they were the subject lose the reference.
  const { error } = await db.from("players").delete().eq("id", player.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
