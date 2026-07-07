import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { TraceProgress } from "@/types/TraceProgress";

const enc = encodeURIComponent;

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
        | { type: "result"; data: ClaimProvenance }
        | { type: "error"; message: string };

      if (msg.type === "progress") onProgress?.(msg.progress);
      else if (msg.type === "result") return msg.data;
      else throw new Error(msg.message);
    }
  }

  throw new Error("The trace ended without a result.");
}
