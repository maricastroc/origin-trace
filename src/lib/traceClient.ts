import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { TraceProgress } from "@/types/TraceProgress";
import type { TraceMetrics } from "@/engine/metrics";

const enc = encodeURIComponent;

export class SearchIncomplete extends Error {
  readonly searchedRevisions: number;
  readonly totalCandidateRevisions: number;

  constructor(
    message: string,
    searchedRevisions: number,
    totalCandidateRevisions: number,
  ) {
    super(message);
    this.name = "SearchIncomplete";
    this.searchedRevisions = searchedRevisions;
    this.totalCandidateRevisions = totalCandidateRevisions;
  }
}

export async function streamTrace(opts: {
  article: string;
  phrase: string;
  lang?: string;
  onProgress?: (p: TraceProgress) => void;
  onMetrics?: (m: TraceMetrics) => void;
  onCached?: (cached: boolean) => void;
  signal?: AbortSignal;
}): Promise<ClaimProvenance> {
  const { article, phrase, lang, onProgress, onMetrics, onCached, signal } =
    opts;

  const langQuery = lang ? `&lang=${enc(lang)}` : "";

  const res = await fetch(
    `/api/trace?article=${enc(article)}&phrase=${enc(phrase)}${langQuery}`,
    { signal },
  );

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }

  const reader = res.body.getReader();

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");

    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const json = frame.replace(/^data:\s?/, "").trim();

      if (!json) continue;

      const msg = JSON.parse(json) as
        | { type: "progress"; progress: TraceProgress }
        | {
            type: "result";
            data: ClaimProvenance;
            metrics?: TraceMetrics;
            cached?: boolean;
          }
        | {
            type: "incomplete";
            message: string;
            searchedRevisions: number;
            totalCandidateRevisions: number;
            metrics?: TraceMetrics;
          }
        | { type: "error"; message: string; metrics?: TraceMetrics };

      if (msg.type === "progress") onProgress?.(msg.progress);
      else if (msg.type === "result") {
        if (msg.metrics) onMetrics?.(msg.metrics);
        onCached?.(msg.cached === true);
        return msg.data;
      } else if (msg.type === "incomplete") {
        if (msg.metrics) onMetrics?.(msg.metrics);
        throw new SearchIncomplete(
          msg.message,
          msg.searchedRevisions,
          msg.totalCandidateRevisions,
        );
      } else {
        if (msg.metrics) onMetrics?.(msg.metrics);
        throw new Error(msg.message);
      }
    }
  }

  throw new Error("The trace ended without a result.");
}
