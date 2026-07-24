import { after, NextResponse } from "next/server";
import { RULES, STORAGE_BUCKET } from "@/lib/config";
import { adminDb, publicUrl } from "@/lib/db";
import {
  applyToMeter,
  buildRoster,
  chargeSubject,
  claimBounty,
  loadEnrolled,
  matchNames,
  oweShots,
  pointsFor,
  stealthMultiplier,
} from "@/lib/game";
import { broadcast } from "@/lib/push";
import { scorePhoto, type Assignment } from "@/lib/score";
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
  const thumbFile = form.get("thumb");
  const bountyId = form.get("bountyId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo received." }, { status: 400 });
  }

  // Recorded so the feed can reserve each row's height before the image lands.
  const dimension = (key: string) => {
    const raw = Number(form.get(key));
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  };
  const width = dimension("width");
  const height = dimension("height");

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
  const id = crypto.randomUUID();
  const path = `shots/${photographer.id}/${id}.jpg`;
  const thumbPath = `shots/${photographer.id}/${id}-thumb.jpg`;

  // The thumbnail rides along, but it is not worth losing a capture over: if
  // it fails the feed just serves the full-size copy for that one photo.
  const [{ error: uploadError }, thumbUpload] = await Promise.all([
    db.storage.from(STORAGE_BUCKET).upload(path, buffer, { contentType: mediaType }),
    thumbFile instanceof File
      ? thumbFile
          .arrayBuffer()
          .then((bytes) =>
            db.storage
              .from(STORAGE_BUCKET)
              .upload(thumbPath, Buffer.from(bytes), { contentType: "image/jpeg" }),
          )
      : Promise.resolve(null),
  ]);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }
  const storagePath = `${STORAGE_BUCKET}/${path}`;
  const storedThumb =
    thumbUpload && !thumbUpload.error ? `${STORAGE_BUCKET}/${thumbPath}` : null;

  // ----------------------------------------------------------- the verdict --
  let assignment: Assignment | null = null;
  let bounty: {
    id: string;
    title: string | null;
    points: number;
    shots: number;
    subject_id: string | null;
  } | null = null;

  if (typeof bountyId === "string" && bountyId) {
    const { data } = await db
      .from("bounties")
      .select("id, title, action, points, shots, subject_id, claimed_by")
      .eq("id", bountyId)
      .single();

    if (data && !data.claimed_by) {
      bounty = {
        id: data.id,
        title: data.title,
        points: data.points,
        shots: data.shots,
        subject_id: data.subject_id,
      };
      const subjectId = data.subject_id ?? target.id;
      const subject = enrolled.find((p) => p.id === subjectId);
      if (subject) {
        assignment = {
          subjectName: subject.name,
          action: data.action,
          title: data.title,
        };
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
      thumb_path: storedThumb,
      width,
      height,
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
      thumb_path: storedThumb,
      width,
      height,
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

  // A rig that lands pays out immediately, on top of whatever the meter did.
  // Straight onto the tab: no threshold to cross, no ratchet afterwards.
  let rigShots = 0;
  if (bountyClaimed && bounty && bounty.shots > 0) {
    rigShots = bounty.shots;
    meter.shots_owed = await oweShots({
      count: rigShots,
      playerId: target.id,
      photoId: photo.id,
      reason: bounty.title ? `Rigged — ${bounty.title}` : verdict.caption,
    });
  }

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

  // ---------------------------------------------------------- the broadcast --
  // The point of the notifications is that the room looks up at the same
  // moment: once when a capture lands, again when Matt goes on the hook for
  // another drink. `after` runs them once the response is already on its way,
  // so the photographer never waits on a fan-out of push deliveries.
  const shotsAdded = meter.shots_added + rigShots;

  after(async () => {
    await broadcast(
      photographer.is_target
        ? {
            title: `🎯 ${photographer.name} caught ${subject.name} out`,
            body: subjectDrinks
              ? `${verdict.caption} — ${subject.name} drinks.`
              : verdict.caption,
            image: publicUrl(storagePath),
            tag: `photo-${photo.id}`,
            url: "/feed",
          }
        : {
            title: `📸 ${photographer.name} caught ${subject.name} · +${totalPoints}`,
            body: verdict.caption,
            image: publicUrl(storagePath),
            tag: `photo-${photo.id}`,
            url: "/feed",
          },
      // The photographer is already staring at this verdict on their own screen.
      { except: [photographer.id] },
    );

    if (shotsAdded > 0) {
      // Everyone, photographer included — this is the gather-round moment.
      await broadcast({
        title: rigShots
          ? `🥃 Rig landed — ${target.name} drinks`
          : `🥃 ${target.name} owes a shot`,
        body:
          meter.shots_owed === 1
            ? "One outstanding. Somebody pour it."
            : `${meter.shots_owed} outstanding. Somebody pour them.`,
        tag: "shots",
        url: "/reckoning",
      });
    }
  });

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
    bountyTitle: bountyClaimed ? bounty?.title ?? null : null,
    rigShots,
    bountyNote: bounty ? verdict.bounty_note : "",
    tags: verdict.tags,
    meter,
    subjectDrinks,
    counterAttack: photographer.is_target,
  });
}
