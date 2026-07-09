import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngineCache, tieredCache, type EngineCache } from "@/engine/cache.ts";
import type { RevisionList } from "@/engine/wikipedia.ts";

const list: RevisionList = {
  revisions: [{ revid: 1, parentid: 0, timestamp: "2020", minor: false }],
  truncated: false,
};

describe("engine content cache", () => {
  it("returns undefined for a miss but distinguishes a cached null", async () => {
    const cache = createEngineCache();
    expect(await cache.getContent("en", 1)).toBeUndefined();

    await cache.setContent("en", 1, null);
    expect(await cache.getContent("en", 1)).toBeNull();

    await cache.setContent("en", 2, "wikitext");
    expect(await cache.getContent("en", 2)).toBe("wikitext");
  });

  it("namespaces entries by language", async () => {
    const cache = createEngineCache();
    await cache.setContent("en", 1, "english");
    await cache.setContent("pt", 1, "portuguese");
    expect(await cache.getContent("en", 1)).toBe("english");
    expect(await cache.getContent("pt", 1)).toBe("portuguese");
  });

  it("evicts the least-recently-used entry past capacity", async () => {
    const cache = createEngineCache(2);
    await cache.setContent("en", 1, "a");
    await cache.setContent("en", 2, "b");
    await cache.getContent("en", 1); // touch 1 so 2 becomes the LRU
    await cache.setContent("en", 3, "c"); // over capacity → evict 2

    expect(await cache.getContent("en", 1)).toBe("a");
    expect(await cache.getContent("en", 3)).toBe("c");
    expect(await cache.getContent("en", 2)).toBeUndefined();
  });
});

describe("engine list cache (TTL)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a cached list within the TTL and drops it afterward", async () => {
    const cache = createEngineCache(4000, 1000);
    await cache.setList("en", "Quokka", list);
    expect(await cache.getList("en", "Quokka")).toEqual(list);

    vi.advanceTimersByTime(1500);
    expect(await cache.getList("en", "Quokka")).toBeUndefined();
  });
});

describe("tieredCache", () => {
  // A counting spy over a plain in-memory cache, to assert L2 is only consulted on
  // an L1 miss and that hits backfill L1.
  function counting(): EngineCache & { reads: number } {
    const inner = createEngineCache();
    const wrap = {
      reads: 0,
      async getContent(lang: string, revid: number) {
        wrap.reads += 1;
        return inner.getContent(lang, revid);
      },
      setContent: inner.setContent.bind(inner),
      getList: inner.getList.bind(inner),
      setList: inner.setList.bind(inner),
    };
    return wrap;
  }

  it("writes through to both layers and reads L1 first", async () => {
    const l1 = createEngineCache();
    const l2 = counting();
    const cache = tieredCache(l1, l2);

    await cache.setContent("en", 1, "x");
    expect(await l2.getContent("en", 1)).toBe("x"); // reached L2 (reads = 1)

    l2.reads = 0;
    expect(await cache.getContent("en", 1)).toBe("x");
    expect(l2.reads).toBe(0); // served from L1, L2 untouched
  });

  it("backfills L1 on an L2 hit", async () => {
    const l1 = createEngineCache();
    const l2 = createEngineCache();
    const cache = tieredCache(l1, l2);

    await l2.setContent("en", 7, "only-in-l2"); // L1 cold, L2 warm
    expect(await cache.getContent("en", 7)).toBe("only-in-l2");
    expect(await l1.getContent("en", 7)).toBe("only-in-l2"); // now backfilled
  });

  it("propagates a cached null through both layers", async () => {
    const cache = tieredCache(createEngineCache(), createEngineCache());
    await cache.setContent("en", 9, null);
    expect(await cache.getContent("en", 9)).toBeNull();
  });
});
