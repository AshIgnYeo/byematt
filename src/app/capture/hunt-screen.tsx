"use client";

import { useEffect, useRef, useState } from "react";
import { shrink } from "@/lib/resize";

type Bounty = {
  id: string;
  action: string;
  points: number;
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
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((d) => setBounties(d.bounties ?? []))
      .catch(() => {});
  }, [result]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = ""; // let the same photo be retried

    setBusy(true);
    setError("");
    setResult(null);

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
        className="mt-6 aspect-square w-full rounded-3xl border-4 border-flash bg-flash/5 text-2xl font-black uppercase tracking-wide text-flash disabled:opacity-50"
      >
        {busy ? "Judging…" : chosen ? "Shoot the assignment" : "Take the shot"}
      </button>

      {chosen && (
        <p className="mt-3 rounded-xl border border-flash/40 bg-flash/10 px-4 py-3 text-sm">
          <span className="font-bold text-flash">Assignment armed:</span>{" "}
          {chosen.subjectEmoji} {chosen.subjectName} {chosen.action} · +{chosen.points}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {result && <Verdict result={result} />}

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Open assignments
        </h2>
        <p className="mt-1 text-xs text-muted">
          Arm one before you shoot. Bonus points only if the judge agrees you nailed it.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {bounties.map((bounty) => {
            const active = bounty.id === picked;
            return (
              <li key={bounty.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPicked(active ? null : bounty.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    active ? "border-flash bg-flash/10" : "border-edge bg-panel"
                  }`}
                >
                  <span className="text-sm">
                    <span aria-hidden>{bounty.subjectEmoji}</span>{" "}
                    <span className="font-bold">{bounty.subjectName}</span>{" "}
                    <span className="text-muted">{bounty.action}</span>
                  </span>
                  <span className="shrink-0 text-sm font-black text-flash">
                    +{bounty.points}
                  </span>
                </button>
              </li>
            );
          })}
          {bounties.length === 0 && (
            <li className="rounded-xl border border-edge px-4 py-6 text-center text-sm text-muted">
              All assignments claimed. Freestyle.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

function Verdict({ result }: { result: Result }) {
  return (
    <article className="flash-in mt-5 overflow-hidden rounded-2xl border border-edge bg-panel">
      {/* Storage URL, no next/image loader needed for a party album. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={result.url} alt={result.caption} className="w-full object-cover" />

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
                Assignment nailed · +{result.bountyPoints} bonus
              </p>
            ) : result.bountyNote ? (
              <p className="mt-2 text-sm text-muted">
                Assignment missed — {result.bountyNote}
              </p>
            ) : null}

            {result.meter?.shots_added ? (
              <p className="mt-3 rounded-lg bg-danger/15 px-3 py-2 text-sm font-black uppercase tracking-wide text-danger">
                🥃 That&rsquo;s a shot. Matt owes {result.meter.shots_owed}.
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
