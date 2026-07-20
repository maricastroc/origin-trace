import type { TraceMetrics, Stage } from "@/engine/metrics";

/**
 * The performance receipt — where this trace's wall-clock actually went. The
 * profiler measures it at the two external seams (the Wikipedia fetch and the
 * cache) plus coarse stage marks, so this is observed, not estimated. It sits
 * next to the CorpusReceipt (which counts *what* was read) and answers the other
 * question a reviewer has: was it cheap, and why. The honest answer the numbers
 * keep giving — nearly all of it is serial Wikipedia latency; the engine's own
 * CPU is a rounding error.
 */

const STAGE_ORDER: Stage[] = [
  "listing",
  "search",
  "read",
  "genealogy",
  "assemble",
];

const STAGE_META: Record<Stage, { label: string; bar: string; dot: string }> = {
  listing: { label: "list", bar: "bg-neutral", dot: "bg-neutral" },
  search: { label: "search", bar: "bg-accent", dot: "bg-accent" },
  read: { label: "read", bar: "bg-warn", dot: "bg-warn" },
  genealogy: { label: "genealogy", bar: "bg-success", dot: "bg-success" },
  assemble: { label: "assemble", bar: "bg-line-strong", dot: "bg-line-strong" },
};

function fmtMs(ms: number): string {
  if (ms < 1) return "0ms";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function EngineReceipt({ metrics }: { metrics?: TraceMetrics }) {
  if (!metrics) return null;

  const { wallMs, stages, network, cache } = metrics;

  const segments = STAGE_ORDER.map((s) => ({ stage: s, ms: stages[s] ?? 0 })).filter(
    (s) => s.ms > 0,
  );
  const stageSum = segments.reduce((a, s) => a + s.ms, 0);

  const other = Math.max(0, wallMs - stageSum);

  const cacheReads = cache.content.reads;
  const hitRate = cacheReads > 0 ? cache.content.hits / cacheReads : null;
  const networkShare = wallMs > 0 ? network.ms / wallMs : 0;

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="kicker">the cost</p>
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-faint">
          {fmtMs(wallMs)} wall
        </p>
      </div>

      {/* Where the wall-clock went */}
      {stageSum > 0 && (
        <>
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-line">
            {segments.map((s) => (
              <span
                key={s.stage}
                className={STAGE_META[s.stage].bar}
                style={{ width: `${(s.ms / wallMs) * 100}%` }}
                title={`${STAGE_META[s.stage].label} · ${fmtMs(s.ms)}`}
                aria-hidden="true"
              />
            ))}
            {other > 0 && (
              <span
                className="bg-line-strong/50"
                style={{ width: `${(other / wallMs) * 100}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-ink-faint">
            {segments.map((s) => (
              <span key={s.stage} className="inline-flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${STAGE_META[s.stage].dot}`}
                  aria-hidden="true"
                />
                {STAGE_META[s.stage].label} · {fmtMs(s.ms)}
              </span>
            ))}
          </div>
        </>
      )}

      {/* The seam counters */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
        <Stat
          value={network.requests.toLocaleString()}
          unit="wiki round-trips"
        />
        <Stat
          value={network.revisionsFetched.toLocaleString()}
          unit="revisions fetched"
        />
        <Stat
          value={hitRate == null ? "—" : `${Math.round(hitRate * 100)}%`}
          unit={`cache hits · ${cache.content.hits}/${cacheReads}`}
        />
        <Stat value={fmtMs(network.ms)} unit="in wikipedia latency" />
      </dl>

      <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-ink-faint">
        {networkShare > 0.6 ? (
          <>
            {Math.round(networkShare * 100)}% of the wall-clock is Wikipedia
            latency — the search is round-trip bound, not compute bound, so the
            engine&rsquo;s own work is a rounding error.
          </>
        ) : hitRate === 1 ? (
          <>
            Every revision was already resident in the cache — this repeat trace
            skipped the network almost entirely.
          </>
        ) : (
          <>
            Measured at the fetch and cache seams; the engine is unaware it is
            being watched, so these numbers don&rsquo;t alter the result.
          </>
        )}
        {network.retries > 0 ? ` ${network.retries} retr${network.retries === 1 ? "y" : "ies"} on backoff.` : ""}
      </p>
    </section>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex flex-col">
      <dd className="font-display text-[24px] leading-none text-ink">{value}</dd>
      <dt className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        {unit}
      </dt>
    </div>
  );
}
