import { NextResponse } from "next/server";
import { RULES, STORAGE_BUCKET } from "@/lib/config";
import { adminDb, publicUrl } from "@/lib/db";
import {
  applyToMeter,
  buildRoster,
  chargeSubject,
  claimBounty,
  loadEnrolled,
  matchNames,
  pointsFor,
  stealthMultiplier,
} from "@/lib/game";
import { scorePhoto } from "@/lib/score";
import { currentPlayer } from "@/lib/session";

export const maxDuration = 60;

/**
 * The whole game loop in one request: upload -> identify -> score -> settle.
 *
 * Nobody declares who is in the photo. The judge matches faces against the
 * enrolled roster, and that decides whether it counts and who drinks.
 */
export async function POST(request: Request) {
  const photographer = await currentPlayer();
  if (!photographer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!photographer.reference_path) {
    return NextResponse.json(
      { error: "Enrol your own photo before you start hunting." },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get("photo");
  const bountyId = form.get("bountyId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo received." }, { status: 400 });
  }

  const db = adminDb();
  const enrolled = await loadEnrolled();
  const target = enrolled.find((p) => p.is_target);

  if (!target) {
    return NextResponse.json(
      { error: "The target hasn't enrolled yet — nobody to hunt." },
      { status: 409 },
    );
  }

  // ------------------------------------------------------------ the upload --
  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "image/jpeg";
  const path = `shots/${photographer.id}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: mediaType });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }
  const storagePath = `${STORAGE_BUCKET}/${path}`;

  // ----------------------------------------------------------- the verdict --
  let assignment: { subjectName: string; action: string } | null = null;
  let bounty: { id: string; points: number; subject_id: string | null } | null = null;

  if (typeof bountyId === "string" && bountyId) {
    const { data } = await db
      .from("bounties")
      .select("id, action, points, subject_id, claimed_by")
      .eq("id", bountyId)
      .single();

    if (data && !data.claimed_by) {
      bounty = { id: data.id, points: data.points, subject_id: data.subject_id };
      const subjectId = data.subject_id ?? target.id;
      const subject = enrolled.find((p) => p.id === subjectId);
      if (subject) {
        assignment = { subjectName: subject.name, action: data.action };
      }
    }
  }

  const roster = await buildRoster(enrolled);
  const verdict = await scorePhoto({
    capture: { base64: buffer.toString("base64"), mediaType },
    roster,
    assignment,
  });

  const detected = matchNames(verdict.present, enrolled);
  const detectedIds = detected.map((p) => p.id);

  // Who does this photo actually score against? Hunters only score on the
  // target; the target only scores on hunters. Self-portraits are worth nothing.
  const subject = photographer.is_target
    ? detected.find((p) => !p.is_target && p.id !== photographer.id)
    : detected.find((p) => p.is_target);

  // ------------------------------------------------------------- the score --
  if (!subject) {
    await db.from("photos").insert({
      photographer_id: photographer.id,
      subject_id: null,
      detected_ids: detectedIds,
      storage_path: storagePath,
      score: 0,
      funniness: verdict.funniness,
      candidness: verdict.candidness,
      caption: verdict.caption,
      tags: verdict.tags,
      verified: false,
      rejected_reason: photographer.is_target
        ? "No hunter recognised in this photo."
        : "Matt isn't in this photo.",
    });

    return NextResponse.json({
      ok: true,
      counted: false,
      reason: photographer.is_target
        ? "Nobody from the roster in that one."
        : "Couldn't find Matt in that one. Get closer.",
      caption: verdict.caption,
      url: publicUrl(storagePath),
    });
  }

  const multiplier = await stealthMultiplier(subject.id);
  const basePoints = pointsFor(verdict, multiplier);

  const { data: photo, error: insertError } = await db
    .from("photos")
    .insert({
      photographer_id: photographer.id,
      subject_id: subject.id,
      detected_ids: detectedIds,
      storage_path: storagePath,
      score: basePoints,
      funniness: verdict.funniness,
      candidness: verdict.candidness,
      stealth_multiplier: multiplier,
      caption: verdict.caption,
      tags: verdict.tags,
      bounty_id: bounty?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !photo) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not save the photo." },
      { status: 500 },
    );
  }

  // ------------------------------------------------------------ the bounty --
  let bountyPoints = 0;
  let bountyClaimed = false;

  if (bounty && verdict.bounty_met) {
    const expectedSubject = bounty.subject_id ?? target.id;
    if (subject.id === expectedSubject) {
      bountyClaimed = await claimBounty({
        bountyId: bounty.id,
        playerId: photographer.id,
        photoId: photo.id,
      });
      if (bountyClaimed) bountyPoints = bounty.points;
    }
  }

  const totalPoints = basePoints + bountyPoints;

  if (bountyPoints || verdict.bounty_met) {
    await db
      .from("photos")
      .update({ bounty_points: bountyPoints, bounty_met: bountyClaimed })
      .eq("id", photo.id);
  }

  // ------------------------------------------------------------- the meter --
  // Hunters push the meter toward Matt's next shot; Matt pushes it back.
  const delta = photographer.is_target
    ? -Math.round(totalPoints * RULES.COUNTER_ATTACK_RATE)
    : totalPoints;

  const meter = await applyToMeter({
    delta,
    photoId: photo.id,
    targetId: target.id,
    reason: verdict.caption,
  });

  // Matt's revenge: whoever he catches drinks too.
  let subjectDrinks = false;
  if (photographer.is_target && RULES.MATT_REVENGE_DRINKS) {
    await chargeSubject({
      playerId: subject.id,
      photoId: photo.id,
      reason: `Caught by Matt — ${verdict.caption}`,
    });
    subjectDrinks = true;
  }

  return NextResponse.json({
    ok: true,
    counted: true,
    url: publicUrl(storagePath),
    subject: { name: subject.name, emoji: subject.emoji },
    caption: verdict.caption,
    funniness: verdict.funniness,
    candidness: verdict.candidness,
    multiplier,
    points: totalPoints,
    bountyPoints,
    bountyNote: bounty ? verdict.bounty_note : "",
    tags: verdict.tags,
    meter,
    subjectDrinks,
    counterAttack: photographer.is_target,
  });
}
