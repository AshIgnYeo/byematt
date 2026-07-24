/**
 * The reason a tab tap feels instant.
 *
 * Without a loading boundary the router has nothing it can render until the
 * server replies, so the old tab sits frozen on screen for the whole round
 * trip. With one, Next also prefetches this shell, so the tap paints the
 * skeleton immediately and the content drops in underneath the tab bar.
 */
export default function TabsLoading() {
  return (
    <main aria-busy className="flex-1 px-5 py-8">
      <span className="sr-only">Loading…</span>

      <div className="h-3 w-24 animate-pulse rounded-full bg-panel" />
      <div className="mt-3 h-9 w-3/5 animate-pulse rounded-lg bg-panel" />

      <div className="mt-8 flex flex-col gap-4">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-24 animate-pulse rounded-2xl border border-edge bg-panel"
          />
        ))}
      </div>
    </main>
  );
}
