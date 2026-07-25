"use client";

import { useEffect, useState } from "react";
import type { AlbumPhoto, AlbumState } from "@/lib/feed";

export function AlbumWall({ initial }: { initial: AlbumState }) {
  // Seeded by the server render, so the wall is up the moment the tab is. The
  // poll below only folds in whatever's been shot since.
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState<AlbumPhoto | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await fetch("/api/album", { cache: "no-store" });
        if (!response.ok) return;
        const data: AlbumState = await response.json();
        if (alive) setState(data);
      } catch {
        // A dropped poll at a bar isn't worth surfacing; the next one retries.
      }
    }

    const timer = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Close the lightbox on Escape, and lock the scroll behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <main className="flex-1 px-4 py-6">
      <header className="mb-5 px-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-flash">
          The album
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">
          {state.count} shot{state.count === 1 ? "" : "s"} of the night
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every picture, hits and misses. Tap one to blow it up.
        </p>
      </header>

      {state.photos.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted">
          Nothing on the wall yet. Somebody go get him.
        </p>
      ) : (
        // Pinterest-style masonry: CSS columns keep each photo at its own
        // height and let the wall pack itself, no per-tile measuring.
        <div className="columns-2 gap-3 md:columns-3 [&>*]:mb-3">
          {state.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpen(photo)}
              className={`flash-in group block w-full break-inside-avoid overflow-hidden rounded-xl border bg-panel text-left ${
                photo.counted ? "border-edge" : "border-edge/50"
              }`}
            >
              {/* Feed-sized copy, with its real dimensions so the column holds
                  its shape before the bytes land. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                loading="lazy"
                decoding="async"
                className={`h-auto w-full transition-transform duration-200 group-active:scale-[0.98] ${
                  photo.counted ? "" : "opacity-80"
                }`}
              />
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate text-xs font-bold">
                  <span aria-hidden>{photo.photographerEmoji}</span>{" "}
                  {photo.photographer}
                </span>
                {photo.counted ? (
                  <span className="shrink-0 text-xs font-black text-flash">
                    +{photo.score}
                  </span>
                ) : (
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-muted">
                    Miss
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption || "Photo"}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/95 p-4 backdrop-blur"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-panel text-lg font-black text-muted"
          >
            ✕
          </button>

          {/* Stop the tap on the photo itself from closing the lightbox. */}
          <figure
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-edge bg-panel"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.full}
              alt={open.caption}
              className="max-h-[70dvh] w-full object-contain"
            />
            <figcaption className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold">
                  <span aria-hidden>{open.photographerEmoji}</span>{" "}
                  {open.photographer}
                  <span className="font-normal text-muted">
                    {open.subject ? ` caught ${open.subject}` : " shot one for the album"}
                  </span>
                </span>
                {open.counted && (
                  <span className="shrink-0 text-lg font-black text-flash">
                    +{open.score}
                  </span>
                )}
              </div>
              {open.caption && (
                <p className="mt-2 leading-snug">&ldquo;{open.caption}&rdquo;</p>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </main>
  );
}
