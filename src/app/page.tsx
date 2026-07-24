import { redirect } from "next/navigation";
import { targetName } from "@/lib/config";
import { currentPlayer } from "@/lib/session";
import { JoinForm } from "./join-form";

export default async function JoinPage() {
  const player = await currentPlayer();
  if (player) redirect(player.reference_path ? "/feed" : "/enroll");

  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-flash">
          Operation
        </p>
        <h1 className="mt-1 text-6xl font-black leading-[0.85] tracking-tighter">
          BYE
          <br />
          MATT
        </h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
          Catch him off guard. The funnier the photo, the faster he drinks.
        </p>
      </header>

      <JoinForm targetName={targetName()} />
    </main>
  );
}
