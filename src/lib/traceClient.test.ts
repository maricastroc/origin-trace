import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchIncomplete, streamTrace } from "@/lib/traceClient";

/** Serve a canned SSE stream in place of the network, so the client's framing
 *  and error mapping can be tested without a route or a wiki. */
function stubStream(frames: unknown[]) {
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
  vi.stubGlobal("fetch", async () => {
    return new Response(new TextEncoder().encode(body), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  });
}

const RESULT = {
  claim: { text: "happiest animal", article: "Quokka" },
  verdict: { primary: "retrofit", confidence: "low", summary: "s" },
  timeline: [],
  credibilityRead: "r",
  meta: { generatedBy: "wikiblame-pipeline" },
};

const call = () =>
  streamTrace({ article: "Quokka", phrase: "happiest animal" });

afterEach(() => vi.unstubAllGlobals());

describe("streamTrace", () => {
  it("returns the trace on a result frame", async () => {
    stubStream([{ type: "result", data: RESULT }]);
    expect((await call()).verdict.primary).toBe("retrofit");
  });

  it("reports whether the result came from the cache", async () => {
    const seen: boolean[] = [];
    stubStream([{ type: "result", data: RESULT, cached: true }]);
    await streamTrace({
      article: "Quokka",
      phrase: "happiest animal",
      onCached: (c) => void seen.push(c),
    });
    expect(seen).toEqual([true]);
  });

  it("maps an incomplete frame to its own type, not a generic failure", async () => {
    // This is the seam the UI branches on: an incomplete search must not reach
    // the "couldn't trace" card, which would tell the reader the claim is absent.
    stubStream([
      {
        type: "incomplete",
        message: "The search ran out of time",
        searchedRevisions: 120,
        totalCandidateRevisions: 1710,
      },
    ]);

    const err = await call().catch((e) => e);

    expect(err).toBeInstanceOf(SearchIncomplete);
    expect(err.searchedRevisions).toBe(120);
    expect(err.totalCandidateRevisions).toBe(1710);
  });

  it("keeps a real failure a real failure", async () => {
    stubStream([{ type: "error", message: "The phrase wasn't found" }]);

    const err = await call().catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SearchIncomplete);
    expect(err.message).toMatch(/wasn't found/);
  });

  it("passes metrics through on every terminal frame", async () => {
    const metrics = { wallMs: 1 } as never;
    for (const frame of [
      {
        type: "incomplete",
        message: "m",
        searchedRevisions: 1,
        totalCandidateRevisions: 2,
        metrics,
      },
      { type: "error", message: "m", metrics },
    ]) {
      const seen: unknown[] = [];
      stubStream([frame]);
      await streamTrace({
        article: "Q",
        phrase: "p",
        onMetrics: (m) => void seen.push(m),
      }).catch(() => {});
      expect(seen).toHaveLength(1);
    }
  });
});
