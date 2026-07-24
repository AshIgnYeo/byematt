import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { currentPlayer } from "@/lib/session";
import { LiveFeed } from "./live-feed";

export default async function FeedPage() {
  const player = await currentPlayer();
  if (!player) redirect("/");
  if (!player.reference_path) redirect("/enroll");

  return (
    <>
      <LiveFeed />
      <Nav />
    </>
  );
}
