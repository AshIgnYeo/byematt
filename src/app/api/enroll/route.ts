import { NextResponse } from "next/server";
import { STORAGE_BUCKET } from "@/lib/config";
import { adminDb } from "@/lib/db";
import { checkReferencePhoto } from "@/lib/score";
import { currentPlayer } from "@/lib/session";

export const maxDuration = 60;

/**
 * Roll call. Every player uploads one clear reference selfie at the start of
 * the night; the judge matches every later capture against this roster.
 */
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo received." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "image/jpeg";

  const check = await checkReferencePhoto({
    base64: buffer.toString("base64"),
    mediaType,
  });

  if (!check.usable) {
    return NextResponse.json(
      { error: check.problem || "That photo won't work for face matching." },
      { status: 422 },
    );
  }

  const db = adminDb();
  const path = `reference/${player.id}.jpg`;

  const { error: uploadError } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: mediaType, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await db
    .from("players")
    .update({
      reference_path: `${STORAGE_BUCKET}/${path}`,
      enrolled_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  return NextResponse.json({ ok: true });
}
