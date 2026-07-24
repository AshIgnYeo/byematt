"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShotsState } from "@/lib/feed";

export function Reckoning({ initial }: { initial: ShotsState }) {
  // Seeded by the server render — the tally is on screen the moment the tab is.
  const [shots, setShots] = useState(initial.shots);
  const [hallOfFame, setHallOfFame] = useState(initial.hallOfFame);

  const load = useCallback(async () => {
    const response = await fetch("/api/shots", { cache: "no-store" });
    if (!response.ok) return;
    const data: ShotsState = await response.json();
    setShots(data.shots ?? []);
    setHallOfFame(data.hallOfFame ?? []);
  }, []);

  useEffect(() => {
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);

  async function settle(shotId: string) {
    setShots((prev) =>
      prev.map((s) => (s.id === shotId ? { ...s, settled: true } : s)),
    );
    await fetch("/api/shots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shotId }),
    });
    load();
  }

  const outstanding = shots.filter((s) => !s.settled);

  return (
    <main className="flex-1 px-5 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-flash">
          The reckoning
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">
          {outstanding.length} shot{outstanding.length === 1 ? "" : "s"} owed
        </h1>
      </header>

      <ul className="mt-6 flex flex-col gap-2">
        {outstanding.map((shot) => (
          <li
            key={shot.id}
            className="flex items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
          >
            <span aria-hidden className="text-xl">
              {shot.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{shot.player}</p>
              <p className="truncate text-xs text-muted">{shot.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => settle(shot.id)}
              className="shrink-0 rounded-full bg-flash px-4 py-2 text-xs font-black uppercase tracking-wide text-ink"
            >
              Drunk
            </button>
          </li>
        ))}

        {outstanding.length === 0 && (
          <li className="rounded-xl border border-edge px-4 py-10 text-center text-sm text-muted">
            Everyone&rsquo;s square. For now.
          </li>
        )}
      </ul>

      <section className="mt-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Hall of fame
        </h2>
        <p className="mt-1 text-sm text-muted">
          The five that did the most damage. Play this back at the end.
        </p>

        <ol className="mt-4 flex flex-col gap-4">
          {hallOfFame.map((photo, index) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-edge bg-panel"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                loading="lazy"
                decoding="async"
                className="h-auto w-full"
              />
              <div className="flex items-baseline justify-between gap-3 p-4">
                <p className="leading-snug">
                  <span className="font-black text-muted">#{index + 1}</span>{" "}
                  &ldquo;{photo.caption}&rdquo;
                </p>
                <span className="shrink-0 text-lg font-black text-flash">
                  {photo.score}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <form action="/api/auth/logout" method="post" className="mt-12">
        <button
          type="submit"
          className="w-full rounded-full border border-edge py-3 text-xs font-bold uppercase tracking-widest text-muted"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
