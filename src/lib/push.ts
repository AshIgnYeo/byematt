import webpush from "web-push";
import { adminDb } from "./db";

/**
 * Web push, party edition. Everyone who opted in gets a buzz when a capture
 * lands and when the meter tips Matt into another drink — the point is that the
 * group looks up at the same moment, not that anyone reads their phone.
 *
 * Push is optional infrastructure: if the VAPID keys aren't set the game plays
 * exactly as before, silently. Nothing here is ever allowed to fail a capture.
 */

export type Alert = {
  title: string;
  body: string;
  /** Same tag = the newer alert replaces the older one on the lock screen. */
  tag?: string;
  /** Where tapping the notification lands. */
  url?: string;
  /** Big picture on Android; iOS ignores it. */
  image?: string;
};

let vapid: "unset" | "ready" | "missing" = "unset";

function configured(): boolean {
  if (vapid === "unset") {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (publicKey && privateKey) {
      // The subject just has to be a contact URL the push service can complain
      // to; nobody checks it for a one-night party app.
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:nobody@byematt.party",
        publicKey,
        privateKey,
      );
      vapid = "ready";
    } else {
      console.warn("[push] VAPID keys not set — notifications are off.");
      vapid = "missing";
    }
  }
  return vapid === "ready";
}

type Row = { endpoint: string; p256dh: string; auth: string; player_id: string };

/**
 * Sends one alert to every subscribed browser except the players in `except` —
 * normally the photographer, who is already looking at the verdict.
 *
 * Endpoints die constantly (reinstalled app, cleared site data, phone offline
 * for days), and a push service answers 404/410 for those. Those get pruned;
 * anything else is logged and shrugged off.
 */
export async function broadcast(
  alert: Alert,
  opts: { except?: string[] } = {},
): Promise<void> {
  if (!configured()) return;

  const db = adminDb();
  const { data } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, player_id");

  const except = new Set(opts.except ?? []);
  const targets = ((data ?? []) as Row[]).filter((row) => !except.has(row.player_id));
  if (targets.length === 0) return;

  const payload = JSON.stringify(alert);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    targets.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          { TTL: 600 }, // a party alert is worthless an hour later
        );
        sent += 1;
      } catch (cause) {
        const status = (cause as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(row.endpoint);
        } else {
          console.error(`[push] ${row.endpoint.slice(0, 40)}… failed:`, cause);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await db.from("push_subscriptions").delete().in("endpoint", dead);
  }

  console.log(
    `[push] "${alert.title}" sent=${sent}/${targets.length} pruned=${dead.length}`,
  );
}
