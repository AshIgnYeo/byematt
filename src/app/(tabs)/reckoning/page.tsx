import { loadShots } from "@/lib/feed";
import { requirePlayer } from "@/lib/session";
import { Reckoning } from "./reckoning";

export default async function ReckoningPage() {
  await requirePlayer();
  const initial = await loadShots();

  return <Reckoning initial={initial} />;
}
