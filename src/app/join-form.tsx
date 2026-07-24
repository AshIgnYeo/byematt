"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinForm({ targetName }: { targetName: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"none" | "hunter" | "target">("none");

  async function join(body: { code: string; name?: string; asTarget?: boolean }) {
    setError("");

    const response = await fetch("/api/auth/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Couldn't get you in.");
      setBusy("none");
      return;
    }

    router.replace(data.enrolled ? "/feed" : "/enroll");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("hunter");
    const form = new FormData(event.currentTarget);
    await join({
      code: String(form.get("code") ?? ""),
      name: String(form.get("name") ?? ""),
    });
  }

  /**
   * The groom's route in. Deliberately ignores the name field — he never types
   * his own name, so there's nothing to get wrong.
   */
  async function onTarget(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const code = String(new FormData(form!).get("code") ?? "");

    if (!code.trim()) {
      setError("Enter the party code first.");
      return;
    }

    setBusy("target");
    await join({ code, asTarget: true });
  }

  const working = busy !== "none";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field name="code" label="Party code" autoComplete="off" autoCapitalize="characters" />
      <Field name="name" label="Your name" autoComplete="given-name" />

      <p className="text-xs leading-relaxed text-muted">
        New name? You&rsquo;ll be added to the roster. Using one that&rsquo;s
        already taken signs you in as them, so pick something distinct.
      </p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={working}
        className="mt-2 rounded-full bg-flash px-6 py-4 text-base font-black uppercase tracking-wide text-ink transition-opacity disabled:opacity-50"
      >
        {busy === "hunter" ? "Checking…" : "I'm in"}
      </button>

      <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
        <span className="h-px flex-1 bg-edge" />
        or
        <span className="h-px flex-1 bg-edge" />
      </div>

      <button
        type="button"
        onClick={onTarget}
        disabled={working}
        className="rounded-full border-2 border-danger px-6 py-4 text-base font-black uppercase tracking-wide text-danger transition-opacity disabled:opacity-50"
      >
        {busy === "target" ? "Good luck…" : `Sign in as ${targetName}`}
      </button>

      <p className="text-center text-xs text-muted">
        {targetName} only. Everyone else is hunting him.
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  ...rest
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </span>
      <input
        name={name}
        className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-lg outline-none focus:border-flash"
        {...rest}
      />
    </label>
  );
}
