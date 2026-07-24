"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The undo for a mis-tapped roll call: wrong person on the target account, or
 * Matt registered as a hunter by typing his name.
 *
 * Two steps on purpose. It's destructive and it lives on the screen everybody
 * passes through, so the first tap only explains what would happen.
 */
export function DeleteProfile({
  name,
  isTarget,
  photoCount,
  targetName,
}: {
  name: string;
  isTarget: boolean;
  photoCount: number;
  targetName: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/delete", { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't remove that profile.");
      }

      // The cookie is gone, so the join screen is the only place left to go.
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something broke.");
      setBusy(false);
    }
  }

  if (!armed) {
    return (
      <section className="mt-10 border-t border-edge pt-5">
        <p className="text-sm text-muted">
          Signed in as <span className="font-bold text-white">{name}</span>
          {isTarget && " — the target"}.
        </p>
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="mt-2 text-sm font-bold text-danger underline underline-offset-2"
        >
          Not you? Delete this profile
        </button>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-danger/50 bg-danger/5 p-4">
      <h2 className="text-sm font-black uppercase tracking-widest text-danger">
        Delete {name}?
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        {isTarget ? (
          <>
            This frees up the target slot — whoever presses{" "}
            <span className="font-bold text-white">Sign in as {targetName}</span>{" "}
            next gets a clean account. Photos of {name} stop counting for
            everyone.
          </>
        ) : (
          <>
            This takes {name} off the roster for good. If that&rsquo;s{" "}
            {targetName}, delete this first, then press{" "}
            <span className="font-bold text-white">Sign in as {targetName}</span>{" "}
            on the join screen.
          </>
        )}
      </p>

      {photoCount > 0 && (
        <p className="mt-2 text-sm font-bold text-danger">
          {photoCount} {photoCount === 1 ? "photo" : "photos"} taken by {name}{" "}
          {photoCount === 1 ? "goes" : "go"} too, along with any shots they owe.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="flex-1 rounded-full bg-danger px-4 py-3 text-sm font-black uppercase tracking-wide text-white disabled:opacity-50"
        >
          {busy ? "Removing…" : "Delete and start over"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={busy}
          className="rounded-full border border-edge px-5 py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
        >
          Keep
        </button>
      </div>
    </section>
  );
}
