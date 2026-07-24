type Props = {
  meter: number;
  threshold: number;
  shotsOwed: number;
  round: number;
};

/** The shared shot meter. Everything in the game is aimed at this bar. */
export function Meter({ meter, threshold, shotsOwed, round }: Props) {
  const pct = Math.min(100, Math.round((meter / threshold) * 100));
  const close = pct >= 80;

  return (
    <section className="border-b border-edge bg-panel px-4 py-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
          Shot meter · round {round}
        </h2>
        <span className="text-xs text-muted">
          {meter} / {threshold}
        </span>
      </div>

      <div
        className="mt-2 h-4 w-full overflow-hidden rounded-full bg-ink ring-1 ring-edge"
        role="progressbar"
        aria-valuenow={meter}
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-label="Progress to Matt's next shot"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            close ? "bg-danger" : "bg-flash"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-sm">
        {shotsOwed > 0 ? (
          <span className="font-bold text-danger">
            Matt owes {shotsOwed} shot{shotsOwed === 1 ? "" : "s"}.
          </span>
        ) : close ? (
          <span className="font-bold text-flash">One good photo away.</span>
        ) : (
          <span className="text-muted">{threshold - meter} points to the next shot.</span>
        )}
      </p>
    </section>
  );
}
