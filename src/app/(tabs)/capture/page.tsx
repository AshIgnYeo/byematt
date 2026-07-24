import { requirePlayer } from "@/lib/session";
import { HuntScreen } from "./hunt-screen";

export default async function CapturePage() {
  const player = await requirePlayer();

  return <HuntScreen isTarget={player.is_target} name={player.name} />;
}
