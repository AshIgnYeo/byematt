import { redirect } from "next/navigation";
import { adminDb } from "@/lib/db";
import { currentPlayer } from "@/lib/session";
import { EnrollForm } from "./enroll-form";

/** Roll call. Nobody can hunt until the roster knows what they look like. */
export default async function EnrollPage() {
  const player = await currentPlayer();
  if (!player) redirect("/");

  const { data: roster } = await adminDb()
    .from("players")
    .select("id, name, emoji, is_target, reference_path")
    .order("name");

  const waiting = (roster ?? []).filter((p) => !p.reference_path);

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-flash">
          Roll call
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">
          {player.reference_path ? "You're on the roster" : `Say cheese, ${player.name}`}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          One clear photo of your face. Every capture tonight gets matched against
          this roster, so the app knows who it&rsquo;s looking at — and nobody can
          score points off a photo of a stranger.
        </p>
      </header>

      <EnrollForm enrolled={player.reference_path !== null} />

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
          Roster · {(roster ?? []).length - waiting.length}/{(roster ?? []).length} enrolled
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(roster ?? []).map((person) => (
            <li
              key={person.id}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                person.reference_path
                  ? "border-flash/40 bg-flash/10 text-flash"
                  : "border-edge text-muted"
              }`}
            >
              <span aria-hidden>{person.emoji}</span> {person.name}
              {person.is_target && " · target"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
