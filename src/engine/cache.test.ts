import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngineCache } from "@/engine/cache.ts";
import type { RevisionList } from "@/engine/wikipedia.ts";

const list: RevisionList = {
  revisions: [{ revid: 1, parentid: 0, timestamp: "2020", minor: false }],
  truncated: false,
};

describe("engine content cache", () => {
  it("returns undefined for a miss but distinguishes a cached null", () => {
    const cache = createEngineCache();
    expect(cache.getContent("en", 1)).toBeUndefined();

    cache.setContent("en", 1, null);
    expect(cache.getContent("en", 1)).toBeNull();

    cache.setContent("en", 2, "wikitext");
    expect(cache.getContent("en", 2)).toBe("wikitext");
  });

  it("namespaces entries by language", () => {
    const cache = createEngineCache();
    cache.setContent("en", 1, "english");
    cache.setContent("pt", 1, "portuguese");
    expect(cache.getContent("en", 1)).toBe("english");
    expect(cache.getContent("pt", 1)).toBe("portuguese");
  });

  it("evicts the least-recently-used entry past capacity", () => {
    const cache = createEngineCache(2);
    cache.setContent("en", 1, "a");
    cache.setContent("en", 2, "b");
    cache.getContent("en", 1); // touch 1 so 2 becomes the LRU
    cache.setContent("en", 3, "c"); // over capacity → evict 2

    expect(cache.getContent("en", 1)).toBe("a");
    expect(cache.getContent("en", 3)).toBe("c");
    expect(cache.getContent("en", 2)).toBeUndefined();
  });
});

describe("engine list cache (TTL)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a cached list within the TTL and drops it afterward", () => {
    const cache = createEngineCache(4000, 1000);
    cache.setList("en", "Quokka", list);
    expect(cache.getList("en", "Quokka")).toEqual(list);

    vi.advanceTimersByTime(1500);
    expect(cache.getList("en", "Quokka")).toBeUndefined();
  });
});
