import { describe, expect, it, vi } from "vitest";
import { WikipediaClient, type FetchJson } from "@/engine/wikipedia.ts";
import { createEngineCache } from "@/engine/cache.ts";

describe("WikipediaClient.listRevisions", () => {
  it("follows rvcontinue and merges pages, oldest-first", async () => {
    const fetchJson: FetchJson = async (url) => {
      const p = new URL(url).searchParams;
      if (!p.get("rvcontinue")) {
        return {
          query: { pages: [{ revisions: [{ revid: 1, timestamp: "2019" }, { revid: 2, timestamp: "2019" }] }] },
          continue: { rvcontinue: "page2" },
        };
      }
      return { query: { pages: [{ revisions: [{ revid: 3, timestamp: "2020" }] }] } };
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
    const fetchJson: FetchJson = async () => ({ query: { pages: [{ missing: true }] } });
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
              { revid: 9, timestamp: "2021-05-01T00:00:00Z", slots: { main: { content: "hello" } } },
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
    const fetchJson: FetchJson = async () => ({ query: { pages: [{ missing: true }] } });
    const client = new WikipediaClient({ fetchJson });
    await expect(client.getCurrentContent("Ghost")).rejects.toThrow(/not found/i);
  });
});

describe("WikipediaClient.getRevisionContent", () => {
  it("resolves a single revision's content, or null when absent", async () => {
    const fetchJson: FetchJson = async (url) => {
      const ids = new URL(url).searchParams.get("revids")!.split("|").map(Number);
      return {
        query: {
          pages: [
            {
              revisions: ids
                .filter((id) => id === 7)
                .map((id) => ({ revid: id, slots: { main: { content: "seven" } } })),
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

describe("WikipediaClient.getContentBatch", () => {
  it("fetches all misses in one request and serves the rest from cache", async () => {
    const fetchJson = vi.fn<FetchJson>(async (url) => {
      const ids = new URL(url).searchParams.get("revids")!.split("|").map(Number);
      return {
        query: {
          pages: [
            { revisions: ids.map((id) => ({ revid: id, slots: { main: { content: `c${id}` } } })) },
          ],
        },
      };
    });
    const cache = createEngineCache();
    const client = new WikipediaClient({ fetchJson, cache });

    const first = await client.getContentBatch([1, 2, 3]);
    expect(first.get(2)).toBe("c2");
    expect(fetchJson).toHaveBeenCalledTimes(1); // three misses, one batched round-trip

    const second = await client.getContentBatch([2, 3, 4]);
    expect(second.get(4)).toBe("c4");
    expect(fetchJson).toHaveBeenCalledTimes(2); // only rev 4 was a miss
    expect(new URL(fetchJson.mock.calls[1][0]).searchParams.get("revids")).toBe("4");
  });
});

describe("WikipediaClient.search", () => {
  it("strips HTML and decodes entities from snippets", async () => {
    const fetchJson: FetchJson = async () => ({
      query: {
        search: [
          {
            title: "Quokka",
            snippet: '<span class="searchmatch">Quokka</span> is &quot;happy&quot; &amp; small',
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
    // insource:"…" matches land inside raw wikitext, so snippets arrive full of
    // markup — including template halves sheared off at the fragment edges.
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
        search: Object.entries(cases).map(([title, snippet]) => ({ title, snippet })),
      },
    });
    const byTitle = Object.fromEntries(
      (await new WikipediaClient({ fetchJson }).search("x")).map((h) => [h.title, h.snippet]),
    );

    // No markup, entities, or template/ref debris survives.
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
        return { query: { pages: [{ revisions: [{ revid: 5, slots: { main: { content: "five" } } }] }] } };
      }
      return { query: { pages: [{ revisions: [{ revid: 5, timestamp: "2020" }] }] } };
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
    const contentCalls = fetchJson.mock.calls.filter(
      ([u]) => new URL(u).searchParams.get("revids"),
    ).length;
    expect(listCalls).toBe(1);
    expect(contentCalls).toBe(1);
  });
});
