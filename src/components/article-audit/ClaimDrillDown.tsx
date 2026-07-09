"use client";

import { useEffect, useState } from "react";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { TraceProgress } from "@/types/TraceProgress";
import { streamTrace } from "@/lib/traceClient";
import { errMsg } from "@/lib/errMsg";
import { CaseFile } from "../case-file/CaseFile";

type TraceState =
  | { status: "idle" }
  | { status: "tracing"; progress: TraceProgress | null }
  | { status: "error"; message: string }
  | { status: "done"; data: ClaimProvenance };

function traceStatus(p: TraceProgress | null): { label: string; pct: number } {
  if (!p) return { label: "Opening the trace…", pct: 4 };
  switch (p.phase) {
    case "listing":
      return { label: "Listing the revision history…", pct: 9 };
    case "listed":
      return {
        label: `${p.revisions.toLocaleString()} revisions in scope`,
        pct: 18,
      };
    case "searching": {
      const ratio = Math.min(1, p.read / Math.max(1, p.estimate));
      return {
        label: "Binary-searching for the introduction…",
        pct: Math.round((0.2 + 0.6 * ratio) * 100),
      };
    }
    case "located":
      return { label: `Introduction located · ${p.year}`, pct: 86 };
    case "reading":
      return { label: "Reading the revisions…", pct: 92 };
    case "detecting":
      // Emitted after `reading`, so it must not sit below it or the bar rewinds.
      return { label: "Detecting the attached citation…", pct: 93 };
    case "genealogy":
      return { label: "Reconstructing the reformulation chain…", pct: 95 };
  }
}

function TraceProgressLine({ progress }: { progress: TraceProgress | null }) {
  const { label, pct } = traceStatus(progress);
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <p className="font-mono text-[12.5px] text-ink">{label}</p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">
          {pct}%
        </span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ClaimDrillDown({
  article,
  lang,
  phrase,
}: {
  article: string;
  lang: string;
  phrase: string;
}) {
  const [state, setState] = useState<TraceState>({
    status: "tracing",
    progress: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    streamTrace({
      article,
      lang,
      phrase,
      signal: controller.signal,
      onProgress: (progress) =>
        live && setState({ status: "tracing", progress }),
    })
      .then((data) => live && setState({ status: "done", data }))
      .catch((err) => {
        if (live && !controller.signal.aborted) {
          setState({ status: "error", message: errMsg(err) });
        }
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [article, lang, phrase]);

  return (
    <div className="rounded-xl border border-line bg-surface-1/40 p-4 sm:p-5">
      {state.status === "tracing" && (
        <TraceProgressLine progress={state.progress} />
      )}

      {state.status === "error" && (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
            couldn&rsquo;t trace this sentence
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {state.message}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            The sentence may have been reworded since it was introduced — the
            exact phrasing isn&rsquo;t in the older history.
          </p>
        </div>
      )}

      {state.status === "done" && <CaseFile data={state.data} />}
    </div>
  );
}
