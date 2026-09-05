import type { ClaimProvenance } from "@/types/ClaimProvenance";
import {
  ClaimNotFoundError,
  SearchIncompleteError,
  traceClaim,
} from "@/engine/trace.ts";
import { requestCaches } from "@/engine/persistent-cache.ts";
import { traceCacheKey } from "@/engine/result-cache.ts";
import { WikipediaClient, createFetchJson } from "@/engine/wikipedia.ts";
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
      const caches = requestCaches(profiler.onCacheOutcome);
      if (caches.health) profiler.attachCacheHealth(caches.health);

      const fetchJson = profiler.instrumentFetch(
        createFetchJson({
          onRetry: profiler.recordRetry,
          signal: request.signal,
        }),
      );
      const cache = profiler.instrumentCache(caches.engine);

      try {
        // The whole-trace cache, keyed by the article's head revision. One tiny
        // request buys the key; a hit then skips listing, search and genealogy
        // entirely. A miss costs that one request, which is the honest price of
        // an invalidation token that can never go stale.
        let key: string | null = null;
        if (caches.results) {
          const head = await new WikipediaClient({ lang, fetchJson, cache })
            .latestRevision(article)
            .catch(() => null);

          if (head) {
            key = traceCacheKey({
              lang,
              article,
              headRevid: head.revid,
              phrase,
            });
            const hit = await caches.results.get(key);
            if (hit) {
              send({
                type: "result",
                // The stored trace was computed for a phrase that normalises to
                // the same thing, not necessarily the same keystrokes. Echo back
                // what this caller actually asked.
                data: { ...hit, claim: { ...hit.claim, text: phrase } },
                metrics: profiler.snapshot(),
                cached: true,
              });
              return;
            }
          }
        }

        const provenance: ClaimProvenance = await traceClaim({
          article,
          phrase,
          lang,
          cache,
          fetchJson,
          onProgress: (progress) => send({ type: "progress", progress }),
          onStage: profiler.onStage,
        });

        // A truncated trace is a degraded answer produced under time pressure.
        // Storing it would freeze that degradation for the life of the entry, so
        // it is returned but never cached — the next caller gets a fresh attempt.
        if (key && caches.results && !provenance.search?.searchTruncated) {
          await caches.results.set(key, provenance);
        }

        send({
          type: "result",
          data: provenance,
          metrics: profiler.snapshot(),
          cached: false,
        });
      } catch (err) {
        if (err instanceof SearchIncompleteError) {
          // Deliberately not an error frame: "we ran out of time" is a different
          // claim from "it isn't there", and the UI must not collapse the two.
          send({
            type: "incomplete",
            searchedRevisions: err.searchedRevisions,
            totalCandidateRevisions: err.totalCandidateRevisions,
            stopReason: err.stopReason,
            message:
              `The search ran out of time after examining ${err.searchedRevisions.toLocaleString()} of ` +
              `${err.totalCandidateRevisions.toLocaleString()} revisions. That is not the same as the claim ` +
              `being absent — it was not found in the part of the history that was read.`,
            metrics: profiler.snapshot(),
          });
          return;
        }
        if (!(err instanceof ClaimNotFoundError))
          console.error("trace failed", err);
        const message =
          err instanceof ClaimNotFoundError
            ? `The phrase wasn't found in the history of "${article}". Try a shorter, more literal excerpt.`
            : "Couldn't finish the trace — Wikipedia may be unreachable or rate-limiting. Please try again.";
        send({ type: "error", message, metrics: profiler.snapshot() });
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
