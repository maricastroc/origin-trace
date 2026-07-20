import { ClaimNotFoundError, traceClaim } from "@/engine/trace.ts";
import { getEngineCache } from "@/engine/persistent-cache.ts";
import { createFetchJson } from "@/engine/wikipedia.ts";
import { TraceProfiler } from "@/engine/metrics.ts";
import { safeLang } from "@/lib/lang";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request, "trace", RATE_LIMITS.trace);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const phrase = searchParams.get("phrase")?.trim();
  const lang = safeLang(searchParams.get("lang"));

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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const profiler = new TraceProfiler();
      try {
        const provenance = await traceClaim({
          article,
          phrase,
          lang,
          cache: profiler.instrumentCache(getEngineCache()),
          fetchJson: profiler.instrumentFetch(
            createFetchJson({
              onRetry: profiler.recordRetry,
              signal: request.signal,
            }),
          ),
          onProgress: (progress) => send({ type: "progress", progress }),
          onStage: profiler.onStage,
        });

        send({ type: "result", data: provenance, metrics: profiler.snapshot() });
      } catch (err) {
        if (!(err instanceof ClaimNotFoundError))
          console.error("trace failed", err);
        const message =
          err instanceof ClaimNotFoundError
            ? `The phrase wasn't found in the history of "${article}". Try a shorter, more literal excerpt.`
            : "Couldn't finish the trace — Wikipedia may be unreachable or rate-limiting. Please try again.";
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
      "X-Accel-Buffering": "no",
    },
  });
}
