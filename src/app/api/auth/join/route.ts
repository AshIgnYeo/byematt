import { NextResponse } from "next/server";
import { SESSION_COOKIE, targetName } from "@/lib/config";
import { adminDb, type Player } from "@/lib/db";
import { mintToken } from "@/lib/session";

/** Assigned on sign-up purely so people are visually distinguishable in the feed. */
const EMOJI = ["📸", "🥷", "🔎", "🫥", "🕵️", "🦝", "🐍", "🎣", "🪤", "👁️", "🦉", "🃏"];

const randomEmoji = () => EMOJI[Math.floor(Math.random() * EMOJI.length)];

/**
 * Join the party: the shared code plus whatever you want to be called. Unknown
 * names register on the spot — there is no preset roster.
 *
 * The groom uses the dedicated button instead, which sets `asTarget`. Nothing is
 * matched against what he types, so he can't knock the game over by entering an
 * unexpected name.
 *
 * Names are matched case-insensitively, so typing a name someone already used
 * signs you in as them. Among friends in one room that's the intended trade.
 */
export async function POST(request: Request) {
  const { code, name, asTarget } = await request.json();

  // Normalise both sides: the code gets typed on a phone keyboard that loves to
  // capitalise, and it gets written into .env by hand in whatever case.
  const expected = (process.env.PARTY_CODE ?? "").trim().toUpperCase();
  if (!expected) {
    return NextResponse.json(
      { error: "PARTY_CODE isn't set on the server." },
      { status: 500 },
    );
  }

  if (String(code).trim().toUpperCase() !== expected) {
    return NextResponse.json({ error: "Wrong party code." }, { status: 401 });
  }

  const db = adminDb();

  // The roster is a dozen people at most, so match in JS rather than building a
  // LIKE pattern out of user input.
  async function roster(): Promise<Player[]> {
    const { data } = await db
      .from("players")
      .select("id, name, emoji, is_target, reference_path");
    return (data ?? []) as Player[];
  }

  const player = asTarget
    ? await signInAsTarget(db, await roster())
    : await signInByName(db, await roster(), name);

  if ("error" in player) {
    return NextResponse.json({ error: player.error }, { status: player.status });
  }

  const response = NextResponse.json({
    ok: true,
    enrolled: player.reference_path !== null,
    isTarget: player.is_target,
    name: player.name,
  });

  response.cookies.set(SESSION_COOKIE, mintToken(player.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 3, // the weekend
  });

  return response;
}

type Failure = { error: string; status: number };
type Db = ReturnType<typeof adminDb>;

/**
 * The groom. There is exactly one target row, so the first press creates it and
 * every press after signs back into the same one.
 */
async function signInAsTarget(db: Db, players: Player[]): Promise<Player | Failure> {
  const existing = players.find((p) => p.is_target);
  if (existing) return existing;

  // A hunter may have already taken the name by typing it. Fall back rather
  // than hijacking their row.
  const taken = new Set(players.map((p) => p.name.toLowerCase()));
  const label = targetName();
  const name = taken.has(label.toLowerCase()) ? `${label} (groom)` : label;

  const { data, error } = await db
    .from("players")
    .insert({ name, emoji: "🎯", is_target: true })
    .select("id, name, emoji, is_target, reference_path")
    .single();

  if (data) return data as Player;

  // Someone pressed the button at the same moment — reuse whatever landed.
  const { data: retry } = await db
    .from("players")
    .select("id, name, emoji, is_target, reference_path")
    .eq("is_target", true)
    .maybeSingle();

  if (retry) return retry as Player;
  return { error: error?.message ?? "Couldn't start the game.", status: 500 };
}

/** Everyone else. Register on first sight, sign in thereafter. */
async function signInByName(
  db: Db,
  players: Player[],
  raw: unknown,
): Promise<Player | Failure> {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Pick a name.", status: 400 };
  if (name.length > 24) return { error: "That name is too long.", status: 400 };

  const existing = players.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );

  // The groom's account is reachable only through the button. Otherwise anyone
  // typing his name would sign in as the target and take the game with them.
  if (existing?.is_target) {
    return {
      error: `That's the groom's account — use the "Sign in as ${existing.name}" button, or pick another name.`,
      status: 409,
    };
  }

  if (existing) return existing;

  const { data, error } = await db
    .from("players")
    .insert({ name, emoji: randomEmoji(), is_target: false })
    .select("id, name, emoji, is_target, reference_path")
    .single();

  if (data) return data as Player;

  // Lost a race against someone registering the same name a moment ago.
  const { data: retry } = await db
    .from("players")
    .select("id, name, emoji, is_target, reference_path");

  const found = (retry ?? []).find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (found) return found as Player;

  return { error: error?.message ?? "Couldn't add you to the roster.", status: 500 };
}
