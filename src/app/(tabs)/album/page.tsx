import { loadAlbum } from "@/lib/feed";
import { requirePlayer } from "@/lib/session";
import { AlbumWall } from "./album-wall";

export default async function AlbumPage() {
  await requirePlayer();
  const state = await loadAlbum();

  return <AlbumWall initial={state} />;
}
