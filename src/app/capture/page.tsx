import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { currentPlayer } from "@/lib/session";
import { HuntScreen } from "./hunt-screen";

export default async function CapturePage() {
  const player = await currentPlayer();
  if (!player) redirect("/");
  if (!player.reference_path) redirect("/enroll");

  return (
    <>
      <HuntScreen isTarget={player.is_target} name={player.name} />
      <Nav />
    </>
  );
}
