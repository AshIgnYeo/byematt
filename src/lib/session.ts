import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./config";
import { adminDb, type Player } from "./db";

/**
 * Sessions are a signed `playerId.signature` cookie. The party code is the only
 * secret — everyone is in the same room, so there's nothing here worth stealing.
 */
function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing environment variable: SESSION_SECRET");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function mintToken(playerId: string): string {
  return `${playerId}.${sign(playerId)}`;
}

function verifyToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const playerId = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(playerId));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? playerId : null;
}

/** The signed-in player, or null. Safe to call from any server component. */
export async function currentPlayer(): Promise<Player | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const playerId = verifyToken(token);
  if (!playerId) return null;

  const { data } = await adminDb()
    .from("players")
    .select("id, name, emoji, is_target, reference_path")
    .eq("id", playerId)
    .single();

  return (data as Player) ?? null;
}
