import type { Resolution } from "@/types/Resolution";

export function ScopePicker({
  resolution,
  onPick,
}: {
  resolution: Resolution;
  onPick: (title: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 p-5 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
        the scope is ambiguous
      </p>
      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
        {resolution.note}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {resolution.candidates.map((c) => (
          <li key={c.title}>
            <button
              onClick={() => onPick(c.title)}
              className="group flex w-full flex-col gap-1 rounded-lg border border-line bg-surface-1/40 px-4 py-3 text-left transition-colors hover:border-ink"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-ink">
                  {c.title}
                </span>
                {c.exactWikitextMatch && (
                  <span className="rounded-full border border-success/40 bg-success-bg px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-success">
                    verbatim
                  </span>
                )}
                {c.fuzzyRank && (
                  <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
                    relevance #{c.fuzzyRank}
                  </span>
                )}
                <span className="ml-auto font-mono text-[12px] text-ink-faint transition-colors group-hover:text-accent">
                  trace →
                </span>
              </div>
              {c.snippet && (
                <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                  {c.snippet}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-faint">
        Not one of these? Name the article in the scope field above.
      </p>
    </div>
  );
}
