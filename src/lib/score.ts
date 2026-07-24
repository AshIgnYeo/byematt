import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const anthropic = new Anthropic();

/**
 * Plain numbers, no .min()/.max(). The API's JSON-schema subset drops numeric
 * constraints, so the SDK would enforce them client-side and throw on an
 * out-of-range value. We clamp instead — a stray 105 shouldn't fail an upload.
 */
const Verdict = z.object({
  present: z
    .array(z.string())
    .describe("Names from the roster who are visibly in the photo. [] if none."),
  candidness: z
    .number()
    .describe("0-100. 100 = totally unaware. 0 = posing for the camera."),
  funniness: z
    .number()
    .describe("0-100. How funny is this photo? Be a harsh, funny judge."),
  caption: z
    .string()
    .describe("One savage, affectionate roast of the moment. Under 15 words."),
  tags: z.array(z.string()).describe("2-4 lowercase one-word tags."),
  bounty_met: z
    .boolean()
    .describe("Does the photo satisfy the assignment? False if none was given."),
  bounty_note: z
    .string()
    .describe("One short line on why the assignment was or wasn't met."),
});

export type Verdict = z.infer<typeof Verdict>;

export type ImageInput = { base64: string; mediaType: string };
export type RosterEntry = { name: string; image: ImageInput };

const SYSTEM = `You are the judge for ByeMatt, a bachelor-party paparazzi game.
Players sneak photos of each other without being noticed; you identify who is in
each photo and rate it.

IDENTIFY: you are given a labelled roster of reference photos. List every roster
member you can actually recognise in the capture. Judge on faces and build, not
on clothing — everyone changes outfits. If you are not reasonably confident it is
a particular person, leave them out; a wrong name costs someone real points.
People who are not on the roster are strangers — ignore them entirely.

SCORE on two axes:
- candidness: how oblivious the subject looks. Mid-action, mid-sentence, mid-bite,
  bad angles and unflattering timing all score high. Eye contact with the camera,
  posing, peace signs and mugging all score low.
- funniness: comic value. Reward genuinely absurd expressions, unfortunate timing,
  chaotic backgrounds and physical comedy. Do not reward a merely blurry or dark
  photo — bad photography is not the same as a funny photo.

Be a tough grader. A pleasant, competent photo of someone standing there is a 20,
not a 60. Reserve 85+ for photos that would actually make the group room erupt.

The caption is read aloud to the whole party. Make it sharp and funny, aimed at
the situation in the photo. Keep it affectionate — this is a friend's send-off,
not an insult. Never comment on unchangeable physical characteristics.`;

function imageBlock(img: ImageInput): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: img.mediaType as "image/jpeg",
      data: img.base64,
    },
  };
}

/**
 * Rates a capture against the enrolled roster.
 *
 * The roster block is byte-identical on every call all night, so it sits at the
 * front of the prompt behind a cache breakpoint — after the first photo, those
 * reference images cost ~10% of list price. The capture and the assignment go
 * after the breakpoint, where they change every time.
 *
 * Opus 4.8 at effort "low" with thinking off: this is a single perception call
 * behind an upload spinner at a party, so latency beats depth.
 */
export async function scorePhoto(opts: {
  capture: ImageInput;
  roster: RosterEntry[];
  assignment?: { subjectName: string; action: string } | null;
}): Promise<Verdict> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `ROSTER — ${opts.roster.length} people, each labelled by name:`,
    },
  ];

  opts.roster.forEach((entry, index) => {
    const image = imageBlock(entry.image);
    // Everything up to here is byte-identical all night; cache the prefix.
    if (index === opts.roster.length - 1) {
      image.cache_control = { type: "ephemeral" };
    }
    content.push({ type: "text", text: `${entry.name}:` }, image);
  });

  content.push({ type: "text", text: "CAPTURE to judge:" }, imageBlock(opts.capture));

  content.push({
    type: "text",
    text: opts.assignment
      ? `Identify who from the roster is in this capture, then rate it.\n\n` +
        `ASSIGNMENT the photographer is attempting: capture ${opts.assignment.subjectName} ${opts.assignment.action}.\n` +
        `Set bounty_met true only if ${opts.assignment.subjectName} is genuinely in the photo AND the described situation is genuinely happening. Be strict — a near miss is a miss.`
      : `Identify who from the roster is in this capture, then rate it. ` +
        `No assignment was attempted: set bounty_met false and leave bounty_note empty.`,
  });

  const response = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(Verdict), effort: "low" },
    messages: [{ role: "user", content }],
  });

  // The roster is the bulk of every request, so cache reads are the difference
  // between pennies and pounds over a night. If `cached` stays at 0 across
  // consecutive captures, the prefix is being invalidated somewhere.
  const usage = response.usage;
  console.log(
    `[score] in=${usage.input_tokens} cached=${usage.cache_read_input_tokens ?? 0} ` +
      `written=${usage.cache_creation_input_tokens ?? 0} out=${usage.output_tokens}`,
  );

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    // Don't lose the capture over a judging failure — bank it at a flat rate
    // and let whoever is running the night sort it out.
    return {
      present: [],
      candidness: 50,
      funniness: 40,
      caption: "The judge is speechless. Points awarded anyway.",
      tags: ["unjudged"],
      bounty_met: false,
      bounty_note: "",
    };
  }

  const v = response.parsed_output;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  return {
    present: v.present,
    candidness: clamp(v.candidness),
    funniness: clamp(v.funniness),
    caption: v.caption.trim(),
    tags: v.tags.slice(0, 4).map((t) => t.toLowerCase()),
    bounty_met: v.bounty_met,
    bounty_note: v.bounty_note.trim(),
  };
}

/**
 * Enrolment check. Confirms a reference selfie is actually usable for face
 * matching before we let someone into the game with it.
 */
const RefCheck = z.object({
  usable: z.boolean().describe("Is exactly one face clearly visible and sharp?"),
  problem: z.string().describe("If unusable, one short line on what to fix."),
});

export async function checkReferencePhoto(image: ImageInput): Promise<{
  usable: boolean;
  problem: string;
}> {
  const response = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 256,
    system:
      "You vet reference photos for a face-matching roster. A photo is usable " +
      "when exactly one person's face is clearly visible, reasonably lit, in " +
      "focus, and large enough in frame to recognise later. Reject group shots, " +
      "heavy blur, deep shadow, sunglasses covering the eyes, or a face turned " +
      "too far away. Be practical, not precious — this is a phone selfie in a bar.",
    output_config: { format: zodOutputFormat(RefCheck), effort: "low" },
    messages: [
      {
        role: "user",
        content: [imageBlock(image), { type: "text", text: "Is this usable?" }],
      },
    ],
  });

  if (!response.parsed_output) return { usable: true, problem: "" };
  return {
    usable: response.parsed_output.usable,
    problem: response.parsed_output.problem.trim(),
  };
}
