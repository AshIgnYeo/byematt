import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { currentPlayer } from "@/lib/session";
import { Reckoning } from "./reckoning";

export default async function ReckoningPage() {
  const player = await currentPlayer();
  if (!player) redirect("/");
  if (!player.reference_path) redirect("/enroll");

  return (
    <>
      <Reckoning />
      <Nav />
    </>
  );
}
