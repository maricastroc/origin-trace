import type { ClaimProvenance } from "@/types/ClaimProvenance";

/** Mirrors the engine's TraceProgress — a type-only shape, no runtime import. */
export type TraceProgress =
  | { phase: "listing" }
  | { phase: "listed"; revisions: number; truncated: boolean }
  | { phase: "searching"; read: number; estimate: number }
  | { phase: "located"; year: string; removed: boolean }
  | { phase: "reading" }
  | { phase: "detecting" };

const enc = encodeURIComponent;

/**
 * Consume the /api/trace SSE stream to completion. Resolves with the provenance,
 * throws on a terminal error. Shared by the live claim explorer and the article
 * audit's per-sentence drill-down so the streaming logic lives in one place.
 */
export async function streamTrace(opts: {
  article: string;
  phrase: string;
  lang?: string;
  onProgress?: (p: TraceProgress) => void;
  signal?: AbortSignal;
}): Promise<ClaimProvenance> {
  const { article, phrase, lang, onProgress, signal } = opts;
  const langQuery = lang ? `&lang=${enc(lang)}` : "";
  const res = await fetch(
    `/api/trace?article=${enc(article)}&phrase=${enc(phrase)}${langQuery}`,
    { signal },
  );

  // A non-stream error (e.g. 400 validation) still comes back as JSON.
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

    // SSE frames are separated by a blank line; keep the trailing partial.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const json = frame.replace(/^data:\s?/, "").trim();
      if (!json) continue;
      const msg = JSON.parse(json) as
        | { type: "progress"; progress: TraceProgress }
        | { type: "result"; data: ClaimProvenance }
        | { type: "error"; message: string };

      if (msg.type === "progress") onProgress?.(msg.progress);
      else if (msg.type === "result") return msg.data;
      else throw new Error(msg.message);
    }
  }

  throw new Error("The trace ended without a result.");
}
