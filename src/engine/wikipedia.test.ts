import { describe, expect, it, vi } from "vitest";
import {
  WikipediaClient,
  createFetchJson,
  type FetchJson,
} from "@/engine/wikipedia.ts";
import { createEngineCache, type EngineCache } from "@/engine/cache.ts";

/** A fetch stand-in that returns a scripted sequence of Responses (repeating the
 *  last one), and counts how many times it was called. */
function scriptedFetch(responses: Response[]) {
  let calls = 0;
  const fetchImpl = (async () => {
    const res = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return res;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });
const rate = (status = 429) =>
  new Response("", { status, headers: { "retry-after": "0" } });

describe("WikipediaClient.listRevisions", () => {
  it("follows rvcontinue and merges pages, oldest-first", async () => {
    const fetchJson: FetchJson = async (url) => {
      const p = new URL(url).searchParams;
      if (!p.get("rvcontinue")) {
        return {
          query: {
            pages: [
              {
                revisions: [
                  { revid: 1, timestamp: "2019" },
                  { revid: 2, timestamp: "2019" },
                ],
              },
            ],
          },
          continue: { rvcontinue: "page2" },
        };
      }
      return {
        query: { pages: [{ revisions: [{ revid: 3, timestamp: "2020" }] }] },
      };
    };
    const client = new WikipediaClient({ fetchJson });
    const { revisions, truncated } = await client.listRevisions("X");
    expect(revisions.map((r) => r.revid)).toEqual([1, 2, 3]);
    expect(truncated).toBe(false);
  });

  it("reports truncated=true when it stops at the maxPages cap", async () => {
    const fetchJson: FetchJson = async () => ({
      query: { pages: [{ revisions: [{ revid: 1, timestamp: "2019" }] }] },
      continue: { rvcontinue: "always-more" },
    });
    const client = new WikipediaClient({ fetchJson, maxPages: 1 });
    const { truncated } = await client.listRevisions("X");
    expect(truncated).toBe(true);
  });

  it("throws when the page is missing", async () => {
    const fetchJson: FetchJson = async () => ({
      query: { pages: [{ missing: true }] },
    });
    const client = new WikipediaClient({ fetchJson });
    await expect(client.listRevisions("Ghost")).rejects.toThrow(/not found/i);
  });
});

describe("WikipediaClient.getCurrentContent", () => {
  it("returns the latest revision id, content and timestamp", async () => {
    const fetchJson: FetchJson = async () => ({
      query: {
        pages: [
          {
            revisions: [
              {
                revid: 9,
                timestamp: "2021-05-01T00:00:00Z",
                slots: { main: { content: "hello" } },
              },
            ],
          },
        ],
      },
    });
    const client = new WikipediaClient({ fetchJson });
    expect(await client.getCurrentContent("X")).toEqual({
      revid: 9,
      content: "hello",
      timestamp: "2021-05-01T00:00:00Z",
    });
  });

  it("returns null when the revision carries no content slot", async () => {
    const fetchJson: FetchJson = async () => ({
      query: { pages: [{ revisions: [{ revid: 9, timestamp: "2021" }] }] },
    });
    const client = new WikipediaClient({ fetchJson });
    expect(await client.getCurrentContent("X")).toBeNull();
  });

  it("throws for a missing article", async () => {
    const fetchJson: FetchJson = async () => ({
      query: { pages: [{ missing: true }] },
    });
    const client = new WikipediaClient({ fetchJson });
    await expect(client.getCurrentContent("Ghost")).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("WikipediaClient.getRevisionContent", () => {
  it("resolves a single revision's content, or null when absent", async () => {
    const fetchJson: FetchJson = async (url) => {
      const ids = new URL(url).searchParams
        .get("revids")!
        .split("|")
        .map(Number);
      return {
        query: {
          pages: [
            {
              revisions: ids
                .filter((id) => id === 7)
                .map((id) => ({
                  revid: id,
                  slots: { main: { content: "seven" } },
                })),
            },
          ],
        },
      };
    };
    const client = new WikipediaClient({ fetchJson });
    expect(await client.getRevisionContent(7)).toBe("seven");
    expect(await client.getRevisionContent(8)).toBeNull();
  });
});

describe("WikipediaClient.getContent", () => {
  it("follows a size-capped continue token so no revid is dropped as empty", async () => {
    const fetchJson = vi.fn<FetchJson>(async (url) => {
      const p = new URL(url).searchParams;
      if (!p.get("rvcontinue")) {
        return {
          query: {
            pages: [
              {
                revisions: [{ revid: 1, slots: { main: { content: "one" } } }],
              },
            ],
          },
          continue: { rvcontinue: "1|2" },
        };
      }
      return {
        query: {
          pages: [
            {
              revisions: [
                { revid: 2, slots: { main: { content: "two" } } },
                { revid: 3, slots: { main: { content: "three" } } },
              ],
            },
          ],
        },
      };
    });
    const client = new WikipediaClient({ fetchJson });
    const map = await client.getContent([1, 2, 3]);
    expect(map.get(1)).toBe("one");
    expect(map.get(2)).toBe("two");
    expect(map.get(3)).toBe("three");
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});

describe("WikipediaClient.getContentBatch", () => {
  it("fetches all misses in one request and serves the rest from cache", async () => {
    const fetchJson = vi.fn<FetchJson>(async (url) => {
      const ids = new URL(url).searchParams
        .get("revids")!
        .split("|")
        .map(Number);
      return {
        query: {
          pages: [
            {
              revisions: ids.map((id) => ({
                revid: id,
                slots: { main: { content: `c${id}` } },
              })),
            },
          ],
        },
      };
    });
    const cache = createEngineCache();
    const client = new WikipediaClient({ fetchJson, cache });

    const first = await client.getContentBatch([1, 2, 3]);
    expect(first.get(2)).toBe("c2");
    expect(fetchJson).toHaveBeenCalledTimes(1);

    const second = await client.getContentBatch([2, 3, 4]);
    expect(second.get(4)).toBe("c4");
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(new URL(fetchJson.mock.calls[1][0]).searchParams.get("revids")).toBe(
      "4",
    );
  });

  it("reads the cache concurrently, not one revision at a time", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const content = new Map<number, string>([
      [1, "c1"],
      [2, "c2"],
      [3, "c3"],
      [4, "c4"],
    ]);
    const cache: EngineCache = {
      async getContent(_lang, revid) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return content.get(revid);
      },
      async setContent() {},
      async getList() {
        return undefined;
      },
      async setList() {},
    };
    const fetchJson: FetchJson = async () => {
      throw new Error("no revision should be fetched — all four are cached");
    };
    const client = new WikipediaClient({ fetchJson, cache });

    const out = await client.getContentBatch([1, 2, 3, 4]);

    expect(out.get(1)).toBe("c1");
    expect(out.get(4)).toBe("c4");
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("collapses repeated revids to a single fetch of one id", async () => {
    const fetchJson = vi.fn<FetchJson>(async (url) => {
      const ids = new URL(url).searchParams.get("revids")!.split("|");
      return {
        query: {
          pages: [
            {
              revisions: ids.map((id) => ({
                revid: Number(id),
                slots: { main: { content: `c${id}` } },
              })),
            },
          ],
        },
      };
    });
    const client = new WikipediaClient({ fetchJson });

    const out = await client.getContentBatch([7, 7, 7]);

    expect(out.get(7)).toBe("c7");
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(new URL(fetchJson.mock.calls[0][0]).searchParams.get("revids")).toBe(
      "7",
    );
  });
});

describe("WikipediaClient.search", () => {
  it("strips HTML and decodes entities from snippets", async () => {
    const fetchJson: FetchJson = async () => ({
      query: {
        search: [
          {
            title: "Quokka",
            snippet:
              '<span class="searchmatch">Quokka</span> is &quot;happy&quot; &amp; small',
          },
        ],
      },
    });
    const client = new WikipediaClient({ fetchJson });
    expect(await client.search("q")).toEqual([
      { title: "Quokka", snippet: 'Quokka is "happy" & small' },
    ]);
  });

  it("cleans wikitext markup out of insource snippets", async () => {
    const cases: Record<string, string> = {
      leadingOrphanTemplate:
        'quote=Coati (also known as the Brazilian aardvark)}}&lt;/ref&gt; the "[[Daily Express]]",&lt;ref&gt;{{cite',
      listItems:
        "*[[Aardvark-Vanaheim]], a publisher *[[Brazilian aardvark]], an example of circular reporting",
      sectionScaffolding:
        "==See also== *{{Annotated link|Brazilian aardvark}} ==References== {{Reflist}}",
    };
    const fetchJson: FetchJson = async () => ({
      query: {
        search: Object.entries(cases).map(([title, snippet]) => ({
          title,
          snippet,
        })),
      },
    });
    const byTitle = Object.fromEntries(
      (await new WikipediaClient({ fetchJson }).search("x")).map((h) => [
        h.title,
        h.snippet,
      ]),
    );

    for (const snippet of Object.values(byTitle)) {
      expect(snippet).not.toMatch(/[{}<>]|&lt;|&gt;|&amp;|\[\[|\]\]|==/);
    }
    expect(byTitle.leadingOrphanTemplate).toBe('the "Daily Express",');
    expect(byTitle.listItems).toBe(
      "Aardvark-Vanaheim, a publisher Brazilian aardvark, an example of circular reporting",
    );
    expect(byTitle.sectionScaffolding).toBe("See also References");
  });
});

describe("WikipediaClient caching", () => {
  it("serves a repeated revision list and content from the cache", async () => {
    const fetchJson = vi.fn<FetchJson>(async (url) => {
      const p = new URL(url).searchParams;
      if (p.get("revids")) {
        return {
          query: {
            pages: [
              {
                revisions: [{ revid: 5, slots: { main: { content: "five" } } }],
              },
            ],
          },
        };
      }
      return {
        query: { pages: [{ revisions: [{ revid: 5, timestamp: "2020" }] }] },
      };
    });
    const cache = createEngineCache();
    const client = new WikipediaClient({ fetchJson, cache });

    await client.listRevisions("X");
    await client.listRevisions("X");
    await client.getRevisionContent(5);
    await client.getRevisionContent(5);

    const listCalls = fetchJson.mock.calls.filter(
      ([u]) => !new URL(u).searchParams.get("revids"),
    ).length;
    const contentCalls = fetchJson.mock.calls.filter(([u]) =>
      new URL(u).searchParams.get("revids"),
    ).length;
    expect(listCalls).toBe(1);
    expect(contentCalls).toBe(1);
  });
});

describe("createFetchJson — retry/backoff", () => {
  it("returns parsed JSON on success, with no retry", async () => {
    const retries: unknown[] = [];
    const { fetchImpl, calls } = scriptedFetch([ok({ v: 1 })]);
    const fetchJson = createFetchJson(
      { onRetry: (i) => retries.push(i), baseDelayMs: 0 },
      fetchImpl,
    );
    expect(await fetchJson("http://x")).toEqual({ v: 1 });
    expect(calls()).toBe(1);
    expect(retries).toHaveLength(0);
  });

  it("retries a 429 then succeeds, reporting the retry", async () => {
    const retries: { attempt: number; reason: string; waitMs: number }[] = [];
    const { fetchImpl, calls } = scriptedFetch([rate(429), ok({ v: 2 })]);
    const fetchJson = createFetchJson(
      { onRetry: (i) => retries.push(i), baseDelayMs: 0 },
      fetchImpl,
    );
    expect(await fetchJson("http://x")).toEqual({ v: 2 });
    expect(calls()).toBe(2);
    expect(retries).toEqual([{ attempt: 0, reason: "429", waitMs: 0 }]);
  });

  it("also retries a 503 (overload)", async () => {
    const { fetchImpl } = scriptedFetch([rate(503), ok({ v: 3 })]);
    const fetchJson = createFetchJson({ baseDelayMs: 0 }, fetchImpl);
    expect(await fetchJson("http://x")).toEqual({ v: 3 });
  });

  it("retries a maxlag error delivered as a 200 body, then succeeds", async () => {
    const maxlag = new Response(
      JSON.stringify({ error: { code: "maxlag", info: "0.8s lagged" } }),
      { status: 200, headers: { "retry-after": "0" } },
    );
    const retries: { reason: string }[] = [];
    const { fetchImpl, calls } = scriptedFetch([maxlag, ok({ v: 4 })]);
    const fetchJson = createFetchJson(
      { baseDelayMs: 0, onRetry: (i) => retries.push(i) },
      fetchImpl,
    );
    expect(await fetchJson("http://x")).toEqual({ v: 4 });
    expect(calls()).toBe(2);
    expect(retries[0].reason).toBe("maxlag");
  });

  it("cancels an in-flight backoff on abort and stops retrying", async () => {
    const ac = new AbortController();
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts++;
      return new Response("", { status: 429 });
    }) as unknown as typeof fetch;
    const fetchJson = createFetchJson(
      { baseDelayMs: 50, signal: ac.signal },
      fetchImpl,
    );

    const outcome = fetchJson("http://x").then(
      () => "resolved",
      (e) => String(e),
    );
    setTimeout(() => ac.abort(), 10); // abort mid-backoff (before the 50ms wait)

    expect(await outcome).toMatch(/abort/i);
    expect(attempts).toBe(1); // the backoff was cancelled, no second attempt
  });

  it("fails fast on a non-retryable status, without retrying", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      new Response("", { status: 404, statusText: "Not Found" }),
    ]);
    const fetchJson = createFetchJson({ baseDelayMs: 0 }, fetchImpl);
    await expect(fetchJson("http://x")).rejects.toThrow(/404/);
    expect(calls()).toBe(1);
  });

  it("gives up after maxRetries and throws", async () => {
    const retries: unknown[] = [];
    const { fetchImpl, calls } = scriptedFetch([rate(429)]);
    const fetchJson = createFetchJson(
      { maxRetries: 3, baseDelayMs: 0, onRetry: (i) => retries.push(i) },
      fetchImpl,
    );
    await expect(fetchJson("http://x")).rejects.toThrow(/429/);
    expect(retries).toHaveLength(3);
    expect(calls()).toBe(4);
  });
});
