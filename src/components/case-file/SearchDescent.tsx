import type { SearchProbe } from "@/types/SearchProbe";

/**
 * Presentational and deterministic — the same {@link SearchProbe}s render the
 * same picture, live during the trace or replayed on a finished case file.
 */

const PAD = 2;
const SPAN = 96;

function pos(index: number, corpusSize: number): number {
  if (corpusSize <= 1) return PAD + SPAN / 2;
  const t = Math.min(1, Math.max(0, index / (corpusSize - 1)));
  return PAD + SPAN * t;
}

export function SearchDescent({
  corpusSize,
  probes,
  originIndex,
  originProven,
  reads,
  span,
  live = false,
}: {
  corpusSize: number;
  probes: SearchProbe[];
  originIndex?: number;
  originProven?: boolean;
  reads?: number;
  span?: { from: string; to: string };
  live?: boolean;
}) {
  if (!corpusSize || probes.length === 0) return null;

  const distinctReads = reads ?? new Set(probes.map((p) => p.index)).size;
  const originPct =
    originIndex != null ? pos(originIndex, corpusSize) : undefined;

  const label = live
    ? `Sampling and bisecting ${corpusSize.toLocaleString()} revisions`
    : `${distinctReads} reads to pin the origin in ${corpusSize.toLocaleString()} revisions`;

  return (
    <section
      className="rounded-xl border border-line-strong bg-surface-1/40 p-5"
      aria-label={`Origin search descent: ${label}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="kicker">the descent</p>
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-faint">
          O(log n) · {distinctReads} of {corpusSize.toLocaleString()} read
        </p>
      </div>

      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {live
          ? "Each row is a revision the search reads; the band is the window it’s narrowing. Watch it converge."
          : "Each row is one revision the search read — filled when the claim was present, hollow when absent. The window collapses onto the first occurrence."}
      </p>

      {/* Oldest → newest axis */}
      <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-ink-ghost">
        <span>← oldest{span ? ` · ${span.from}` : ""}</span>
        <span>newest{span ? ` · ${span.to}` : ""} →</span>
      </div>

      {/* Waterfall — guide and rows share this box, so `left: %` aligns */}
      <div className="relative mt-2">
        {originPct != null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-accent/60"
            style={{ left: `${originPct}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[9px] uppercase tracking-widest text-accent">
              origin
            </span>
          </div>
        )}

        <ol className="space-y-0.75">
          {probes.map((p) => {
            const left = pos(p.lo, corpusSize);
            const right = pos(Math.max(p.lo, p.hi - 1), corpusSize);
            const width = Math.max(0.8, right - left);
            const dotLeft = pos(p.index, corpusSize);
            const isSample = p.kind === "sample";
            const shape = isSample
              ? "rotate-45 rounded-[1px]"
              : "rounded-full";
            const fill = p.hit
              ? "bg-accent border border-accent"
              : "bg-surface-2 border border-ink-ghost";
            return (
              <li
                key={p.step}
                className={`relative h-2.25 ${live ? "animate-rise" : ""}`}
                title={`step ${p.step} · ${p.kind} · rev #${p.index} of ${corpusSize} (${p.timestamp.slice(0, 7)}) · ${p.hit ? "present" : "absent"}`}
              >
                <span
                  className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line"
                  aria-hidden="true"
                />
                <span
                  className="absolute top-1/2 h-1.75 -translate-y-1/2 rounded-xs bg-accent/10"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  aria-hidden="true"
                />
                {/* the revision the search read */}
                <span
                  className={`absolute top-1/2 h-1.75 w-1.75 -translate-x-1/2 -translate-y-1/2 ${shape} ${fill}`}
                  style={{ left: `${dotLeft}%` }}
                  aria-hidden="true"
                />
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 font-mono text-[10.5px] text-ink-faint">
        <LegendMark className="rounded-full bg-accent" /> present
        <LegendMark className="rounded-full border border-ink-ghost bg-surface-2" />
        absent
        <LegendMark className="rotate-45 rounded-[1px] border border-ink-ghost bg-surface-2" />
        sample
        <LegendMark className="rounded-full border border-ink-ghost bg-surface-2" />
        bisect
        {!live && (
          <span className="ml-auto text-ink-ghost">
            {originProven ? "origin proven" : "earliest sampled"}
          </span>
        )}
      </div>
    </section>
  );
}

function LegendMark({ className }: { className: string }) {
  return (
    <span
      className={`inline-block h-1.75 w-1.75 ${className}`}
      aria-hidden="true"
    />
  );
}
