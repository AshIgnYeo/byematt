"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { shrink } from "@/lib/resize";

export function EnrollForm({ enrolled }: { enrolled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "done">(
    enrolled ? "done" : "idle",
  );
  const [error, setError] = useState("");

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setStatus("working");
    setPreview(URL.createObjectURL(file));

    // References only need to be big enough to recognise a face later.
    const small = await shrink(file, 720, 0.9);
    const body = new FormData();
    body.append("photo", small);

    const response = await fetch("/api/enroll", { method: "POST", body });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "That didn't upload.");
      setStatus("idle");
      return;
    }

    setStatus("done");
    router.refresh();
  }

  return (
    <div className="mt-8">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        onChange={onPick}
        className="sr-only"
      />

      {preview && (
        // Blob URL from the local file — next/image would need a loader for no gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Your reference photo"
          className="mb-4 aspect-square w-full rounded-2xl object-cover ring-1 ring-edge"
        />
      )}

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={status === "working"}
        className="w-full rounded-full bg-flash px-6 py-4 text-base font-black uppercase tracking-wide text-ink disabled:opacity-50"
      >
        {status === "working"
          ? "Checking the shot…"
          : status === "done"
            ? "Retake"
            : "Take reference photo"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {status === "done" && (
        <a
          href="/feed"
          className="mt-3 block rounded-full border border-edge px-6 py-4 text-center text-base font-bold uppercase tracking-wide"
        >
          Start hunting →
        </a>
      )}
    </div>
  );
}
