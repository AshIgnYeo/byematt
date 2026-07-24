import { Nav } from "@/components/Nav";
import { requirePlayer } from "@/lib/session";

/**
 * The three signed-in tabs share this shell so the tab bar is one component
 * that stays mounted across navigations, rather than being torn down and
 * rebuilt by each page. Switching tabs now swaps only the content below it,
 * and the active-tab highlight moves on tap instead of waiting for the server.
 */
export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlayer();

  return (
    <>
      {children}
      <Nav />
    </>
  );
}
