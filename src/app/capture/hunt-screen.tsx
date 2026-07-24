"use client";

import { useEffect, useRef, useState } from "react";
import { shrink } from "@/lib/resize";

type Bounty = {
  id: string;
  title: string | null;
  action: string;
  points: number;
  shots: number;
  subjectName: string;
  subjectEmoji: string;
};

type Result = {
  counted: boolean;
  reason?: string;
  url: string;
  caption: string;
  subject?: { name: string; emoji: string };
  points?: number;
  bountyPoints?: number;
  bountyTitle?: string | null;
  rigShots?: number;
  bountyNote?: string;
  funniness?: number;
  candidness?: number;
  multiplier?: number;
  tags?: string[];
  subjectDrinks?: boolean;
  counterAttack?: boolean;
  meter?: { shots_added: number; shots_owed: number };
};

export function HuntScreen({ isTarget, name }: { isTarget: boolean; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  // Matt has no rigs of his own — the list exists to be kept away from him.
  useEffect(() => {
    if (isTarget) return;
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((d) => setBounties(d.bounties ?? []))
      .catch(() => {});
  }, [isTarget, result]);

  // Frees the previous shot's blob URL as soon as it leaves the screen.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = ""; // let the same photo be retried

    setBusy(true);
    setError("");
    setResult(null);
    setPreview(URL.createObjectURL(file));

    try {
      const body = new FormData();
      body.append("photo", await shrink(file));
      if (picked) body.append("bountyId", picked);

      const response = await fetch("/api/capture", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Upload failed.");

      setResult(data);
      setPicked(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something broke.");
    } finally {
      setBusy(false);
    }
  }

  const chosen = bounties.find((b) => b.id === picked);

  // The shot sits under the shutter while the judge reads it, then hands off to
  // the verdict card — one photo on screen at a time, never a black hole.
  const holding = preview && !result;

  return (
    <main className="flex flex-1 flex-col px-5 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-flash">
          {isTarget ? "Counter-attack" : "The hunt"}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {isTarget ? `Shoot back, ${name}` : "Catch Matt"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isTarget
            ? "Every hunter you catch off guard pulls your meter down — and they drink for it."
            : "Point, shoot, upload. The judge decides how funny it was."}
        </p>
      </header>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="sr-only"
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={`relative mt-6 aspect-square w-full overflow-hidden rounded-3xl border-4 border-flash bg-flash/5 text-2xl font-black uppercase tracking-wide text-flash ${
          holding ? "" : "disabled:opacity-50"
        }`}
      >
        {holding && (
          <>
            {/* Local blob, not the uploaded copy — it paints instantly. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-ink/60" />
          </>
        )}

        <span className={`relative ${busy ? "animate-pulse" : ""}`}>
          {busy ? "Judging…" : chosen ? "Shoot the rig" : "Take the shot"}
        </span>
      </button>

      {chosen && (
        <p className="mt-3 rounded-xl border border-flash/40 bg-flash/10 px-4 py-3 text-sm">
          <span className="font-bold text-flash">Rig armed:</span>{" "}
          {chosen.title && <span className="font-bold">{chosen.title} — </span>}
          {chosen.subjectEmoji} {chosen.subjectName} {chosen.action} · +{chosen.points}
          {chosen.shots > 0 && ` · 🥃×${chosen.shots}`}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {result && <Verdict result={result} preview={preview} />}

      {!isTarget && (
        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-danger">
            Rigged jobs
          </h2>
          <p className="mt-1 text-xs text-muted">
            None of these happen on their own. How you get him there is up to
            you — land it and Matt drinks on the spot.
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {bounties.map((bounty) => (
              <li key={bounty.id}>
                <RigCard
                  bounty={bounty}
                  active={bounty.id === picked}
                  onToggle={() =>
                    setPicked(bounty.id === picked ? null : bounty.id)
                  }
                />
              </li>
            ))}
            {bounties.length === 0 && (
              <li className="rounded-xl border border-edge px-4 py-6 text-center text-sm text-muted">
                Every job pulled off. Freestyle.
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}

/**
 * The card says what the photo has to show and nothing about how to get it.
 * That half is the actual game, and a table of six people will always come up
 * with something better than a line of seed data. Tapping it arms the shot.
 */
function RigCard({
  bounty,
  active,
  onToggle,
}: {
  bounty: Bounty;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? "border-flash bg-flash/10" : "border-danger/40 bg-panel"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-black uppercase tracking-wide">
          {bounty.title ?? "Rigged job"}
        </span>
        <span className="shrink-0 text-sm font-black text-flash">
          {bounty.shots > 0 && (
            <span className="mr-2 text-danger">
              🥃{bounty.shots > 1 ? `×${bounty.shots}` : ""}
            </span>
          )}
          +{bounty.points}
        </span>
      </div>

      <p className="mt-1 text-sm leading-relaxed">
        <span aria-hidden>{bounty.subjectEmoji}</span>{" "}
        <span className="font-bold">{bounty.subjectName}</span>{" "}
        <span className="text-muted">{bounty.action}</span>
      </p>
    </button>
  );
}

function Verdict({ result, preview }: { result: Result; preview: string | null }) {
  return (
    <article className="flash-in mt-5 overflow-hidden rounded-2xl border border-edge bg-panel">
      {/* The blob we already have beats a round trip to storage for the same
          pixels; the feed serves result.url to everyone else. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview ?? result.url}
        alt={result.caption}
        className="w-full object-cover"
      />

      <div className="p-4">
        {result.counted ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-3xl font-black text-flash">+{result.points}</span>
              <span className="text-xs uppercase tracking-widest text-muted">
                funny {result.funniness} · candid {result.candidness}
                {result.multiplier !== 1 && ` · ×${result.multiplier}`}
              </span>
            </div>

            <p className="mt-2 text-lg font-bold leading-snug">
              &ldquo;{result.caption}&rdquo;
            </p>

            {result.bountyPoints ? (
              <p className="mt-2 text-sm font-bold text-flash">
                {result.bountyTitle
                  ? `${result.bountyTitle} — pulled off`
                  : "Rig pulled off"}{" "}
                · +{result.bountyPoints} bonus
              </p>
            ) : result.bountyNote ? (
              <p className="mt-2 text-sm text-muted">
                Rig missed — {result.bountyNote}
              </p>
            ) : null}

            {(result.meter?.shots_added || result.rigShots) ? (
              <p className="mt-3 rounded-lg bg-danger/15 px-3 py-2 text-sm font-black uppercase tracking-wide text-danger">
                🥃{" "}
                {result.rigShots
                  ? `The rig landed. ${result.rigShots > 1 ? `${result.rigShots} shots` : "That's a shot"}, straight away.`
                  : "That's a shot."}{" "}
                Matt owes {result.meter?.shots_owed}.
              </p>
            ) : null}

            {result.subjectDrinks && (
              <p className="mt-2 text-sm font-bold text-danger">
                {result.subject?.name} drinks for getting caught.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-danger">Doesn&rsquo;t count</p>
            <p className="mt-1 text-sm text-muted">{result.reason}</p>
          </>
        )}
      </div>
    </article>
  );
}
