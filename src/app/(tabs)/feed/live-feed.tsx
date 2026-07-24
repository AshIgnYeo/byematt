"use client";

import { useEffect, useState } from "react";
import { Meter } from "@/components/Meter";
import type { FeedState } from "@/lib/feed";

export function LiveFeed({ initial }: { initial: FeedState }) {
  // Seeded by the server render, so the feed paints with the night already in
  // it. The poll below only has to keep it moving.
  const [state, setState] = useState(initial);
  const [tab, setTab] = useState<"feed" | "board">("feed");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (alive) setState(data);
      } catch {
        // A dropped poll at a bar is not worth surfacing; the next one retries.
      }
    }

    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <main className="flex-1">
      {state.game && (
        <Meter
          meter={state.game.meter}
          threshold={state.game.threshold}
          shotsOwed={state.game.shots_owed}
          round={state.game.round}
        />
      )}

      <div className="sticky top-0 z-30 grid grid-cols-2 border-b border-edge bg-ink/95 backdrop-blur">
        {(["feed", "board"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`py-3 text-xs font-black uppercase tracking-[0.2em] ${
              tab === key ? "text-flash" : "text-muted"
            }`}
          >
            {key === "feed" ? "The wire" : "Standings"}
          </button>
        ))}
      </div>

      {tab === "board" ? (
        <Standings rows={state.leaderboard} />
      ) : (
        <ul className="flex flex-col gap-4 p-4">
          {state.feed.map((photo) => (
            <li
              key={photo.id}
              className={`flash-in overflow-hidden rounded-2xl border bg-panel ${
                photo.counted ? "border-edge" : "border-edge/50"
              }`}
            >
              {/* Feed-sized copy, and its real dimensions so the row holds its
                  height before the bytes land — otherwise the whole list jumps
                  around as photos fill in. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                loading="lazy"
                decoding="async"
                className={`h-auto w-full ${photo.counted ? "" : "opacity-80"}`}
              />

              <div className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold">
                    <span aria-hidden>{photo.photographerEmoji}</span>{" "}
                    {photo.photographer}
                    <span className="font-normal text-muted">
                      {photo.counted
                        ? `${photo.counterAttack ? " struck back at " : " caught "}${photo.subject}`
                        : " shot one for the album"}
                    </span>
                  </span>

                  {photo.counted ? (
                    <span
                      className={`shrink-0 text-lg font-black ${
                        photo.counterAttack ? "text-danger" : "text-flash"
                      }`}
                    >
                      {photo.counterAttack ? "−" : "+"}
                      {photo.score}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-muted">
                      No score
                    </span>
                  )}
                </div>

                <p
                  className={`mt-2 leading-snug ${photo.counted ? "" : "text-muted"}`}
                >
                  &ldquo;{photo.caption}&rdquo;
                </p>

                {photo.counted ? (
                  <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                    funny {photo.funniness} · candid {photo.candidness}
                    {photo.multiplier !== 1 && ` · ×${photo.multiplier}`}
                    {photo.bountyPoints > 0 && ` · bounty +${photo.bountyPoints}`}
                  </p>
                ) : (
                  photo.reason && (
                    <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                      {photo.reason}
                    </p>
                  )
                )}
              </div>
            </li>
          ))}

          {state.feed.length === 0 && (
            <li className="py-16 text-center text-sm text-muted">
              Nothing on the wire yet. Somebody go get him.
            </li>
          )}
        </ul>
      )}
    </main>
  );
}

function Standings({ rows }: { rows: FeedState["leaderboard"] }) {
  return (
    <ol className="flex flex-col gap-2 p-4">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className="flex items-center gap-3 rounded-xl border border-edge bg-panel px-4 py-3"
        >
          <span className="w-6 text-lg font-black text-muted">{index + 1}</span>
          <span aria-hidden className="text-xl">
            {row.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{row.name}</p>
            <p className="text-xs text-muted">
              {row.captures} caught · {row.bounties} assignments
              {row.owes > 0 && ` · owes ${row.owes} 🥃`}
            </p>
          </div>
          <span className="text-xl font-black text-flash">{row.points}</span>
        </li>
      ))}
    </ol>
  );
}
