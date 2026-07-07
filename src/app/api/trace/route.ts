import { ClaimNotFoundError, traceClaim } from "@/engine/trace.ts";
import { sharedEngineCache } from "@/engine/cache.ts";

/** The engine uses Node's fetch and reads live wikitext — Node.js runtime. */
export const runtime = "nodejs";
/** A full trace does dozens of sequential reads; give it room (Vercel hint). */
export const maxDuration = 120;

/**
 * GET /api/trace?article=Quokka&phrase=happiest%20animal&lang=en
 *
 * Streams the WikiBlame pipeline as Server-Sent Events so the UI can show real
 * progress instead of a faked spinner. Each message is one JSON object:
 *   { type: "progress", progress: TraceProgress }
 *   { type: "result",   data: ClaimProvenance }   // terminal, success
 *   { type: "error",    message: string }          // terminal, failure
 * Repeat traces of the same article are served from an in-process cache.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const phrase = searchParams.get("phrase")?.trim();
  const lang = searchParams.get("lang")?.trim() || "en";

  if (!article || !phrase) {
    return Response.json(
      { error: "Provide 'article' and 'phrase'." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // Client went away mid-stream — stop trying to write.
          closed = true;
        }
      };

      try {
        const provenance = await traceClaim({
          article,
          phrase,
          lang,
          cache: sharedEngineCache,
          onProgress: (progress) => send({ type: "progress", progress }),
        });
        send({ type: "result", data: provenance });
      } catch (err) {
        const message =
          err instanceof ClaimNotFoundError
            ? `The phrase wasn't found in the history of "${article}". Try a shorter, more literal excerpt.`
            : err instanceof Error
              ? err.message
              : String(err);
        send({ type: "error", message });
      } finally {
        if (!closed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Defeat proxy buffering (e.g. nginx) so events flush as they happen.
      "X-Accel-Buffering": "no",
    },
  });
}
