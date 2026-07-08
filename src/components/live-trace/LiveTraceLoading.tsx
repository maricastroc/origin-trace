"use client";

import { useEffect, useState } from "react";
import type { TraceProgress } from "@/types/TraceProgress";

function readProgress(p: TraceProgress | null): {
  label: string;
  fraction: number;
  detail: string;
} {
  if (!p) {
    return {
      label: "Opening the trace…",
      fraction: 0.04,
      detail: "Reaching Wikipedia’s Action API.",
    };
  }
  switch (p.phase) {
    case "listing":
      return {
        label: "Listing the revision history…",
        fraction: 0.09,
        detail: "Enumerating every revision, oldest first.",
      };
    case "listed":
      return {
        label: `${p.revisions.toLocaleString()} revisions in scope`,
        fraction: 0.18,
        detail: p.truncated
          ? "History truncated by the page cap — closure unproven."
          : "Full history enumerated.",
      };
    case "searching": {
      const ratio = Math.min(1, p.read / Math.max(1, p.estimate));
      return {
        label: "Binary-searching for the introduction…",
        fraction: 0.2 + 0.6 * ratio,
        detail: `Read ${p.read} revision${p.read === 1 ? "" : "s"} so far.`,
      };
    }
    case "located":
      return {
        label: `Introduction located · ${p.year}`,
        fraction: 0.86,
        detail: p.removed
          ? "The claim was later removed — tracing its window."
          : "Reading the current revision to compare.",
      };
    case "reading":
      return {
        label: "Reading the revisions’ wikitext…",
        fraction: 0.92,
        detail: "Introduction and current revision.",
      };
    case "detecting":
      return {
        label: "Detecting the attached citation…",
        fraction: 0.9,
        detail: "Looking for a <ref> on the claim.",
      };
    case "genealogy":
      return {
        label: "Reconstructing the reformulation chain…",
        fraction: 0.94,
        detail:
          p.hop > 0
            ? `Walked back ${p.hop} rewording${p.hop === 1 ? "" : "s"}.`
            : "Reading the diff of each rewording.",
      };
  }
}

export function LiveTraceLoading({ progress }: { progress: TraceProgress | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { label, fraction, detail } = readProgress(progress);
  const pct = Math.round(fraction * 100);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 px-5 py-6 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <p className="font-mono text-[13px] text-ink">{label}</p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">
          {elapsed}s
        </span>
      </div>

      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2.5 flex items-center justify-between gap-3 text-[12.5px] leading-relaxed text-ink-faint">
        <span>{detail}</span>
        <span className="shrink-0 font-mono tabular-nums text-ink-muted">
          {pct}%
        </span>
      </p>
    </div>
  );
}
