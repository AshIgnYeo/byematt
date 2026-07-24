import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { PushAlerts } from "@/components/PushAlerts";
import { currentPlayer } from "@/lib/session";
import { LiveFeed } from "./live-feed";

export default async function FeedPage() {
  const player = await currentPlayer();
  if (!player) redirect("/");
  if (!player.reference_path) redirect("/enroll");

  return (
    <>
      {/* Above the meter: seen on the way in, scrolls away once it's dealt with. */}
      <PushAlerts />
      <LiveFeed />
      <Nav />
    </>
  );
}
