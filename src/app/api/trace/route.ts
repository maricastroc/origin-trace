import { ClaimNotFoundError, traceClaim } from "@/engine/trace.ts";
import { getEngineCache } from "@/engine/persistent-cache.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      try {
        const provenance = await traceClaim({
          article,
          phrase,
          lang,
          cache: getEngineCache(),
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
      "X-Accel-Buffering": "no",
    },
  });
}
