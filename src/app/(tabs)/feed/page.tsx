import { PushAlerts } from "@/components/PushAlerts";
import { loadState } from "@/lib/feed";
import { requirePlayer } from "@/lib/session";
import { LiveFeed } from "./live-feed";

export default async function FeedPage() {
  // The layout already resolved the player; `currentPlayer` is cached for the
  // request, so this costs nothing and keeps the page readable on its own.
  const player = await requirePlayer();
  const state = await loadState(player);

  return (
    <>
      {/* Above the meter: seen on the way in, scrolls away once it's dealt with. */}
      <PushAlerts />
      <LiveFeed initial={state} />
    </>
  );
}
