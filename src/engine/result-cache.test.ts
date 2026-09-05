import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { createBreaker } from "@/engine/cache-guard.ts";
import {
  guardedResultStore,
  normalizeTitle,
  redisResultStore,
  traceCacheKey,
} from "@/engine/result-cache.ts";

const BASE = {
  lang: "en",
  article: "Quokka",
  headRevid: 1_373_272_307,
  phrase: "happiest animal",
};

const key = (over: Partial<typeof BASE> = {}) =>
  traceCacheKey({ ...BASE, ...over });

const PROVENANCE = {
  claim: { text: "happiest animal", article: "Quokka" },
  verdict: { primary: "retrofit", confidence: "low", summary: "s" },
  timeline: [],
  credibilityRead: "r",
  meta: { generatedBy: "wikiblame-pipeline" },
} as unknown as ClaimProvenance;

function fakeRedis() {
  const store = new Map<string, string>();
  const redis = {
    async get<T>(k: string): Promise<T | null> {
      return store.has(k) ? (store.get(k) as unknown as T) : null;
    },
    async set(k: string, v: string) {
      store.set(k, v);
      return "OK";
    },
  };
  return { redis: redis as unknown as Redis, store };
}

describe("normalizeTitle", () => {
  it("applies MediaWiki's own normalisation", () => {
    expect(normalizeTitle("  brazilian_aardvark  ")).toBe("Brazilian aardvark");
    expect(normalizeTitle("Brazilian   aardvark")).toBe("Brazilian aardvark");
    expect(normalizeTitle("quokka")).toBe("Quokka");
  });

  it("capitalises the first character, as the wiki itself does", () => {
    expect(normalizeTitle("pH")).toBe(normalizeTitle("PH"));
  });

  it("does not fold case beyond the first character", () => {
    expect(normalizeTitle("NaN party")).not.toBe(normalizeTitle("Nan party"));
  });
});

describe("traceCacheKey", () => {
  it("is stable across case, edge space and repeated space", () => {
    const canonical = key();
    expect(key({ phrase: "Happiest Animal" })).toBe(canonical);
    expect(key({ phrase: "  happiest animal  " })).toBe(canonical);
    expect(key({ phrase: "happiest   animal" })).toBe(canonical);
    expect(key({ phrase: "HAPPIEST\tANIMAL" })).toBe(canonical);
  });

  it("folds accented text only as far as the engine folds it", () => {
    expect(traceCacheKey({ ...BASE, phrase: "SÃO PAULO" })).toBe(
      traceCacheKey({ ...BASE, phrase: "São Paulo" }),
    );
    expect(traceCacheKey({ ...BASE, phrase: "Sao Paulo" })).not.toBe(
      traceCacheKey({ ...BASE, phrase: "São Paulo" }),
    );
  });

  it("is stable across title spelling that MediaWiki treats as one title", () => {
    expect(key({ article: "quokka" })).toBe(key());
    expect(key({ article: "Quokka_" })).toBe(key());
  });

  it("changes when the head revision changes", () => {
    expect(key({ headRevid: BASE.headRevid + 1 })).not.toBe(key());
  });

  it("changes when the phrase, article or language changes", () => {
    expect(key({ phrase: "saddest animal" })).not.toBe(key());
    expect(key({ article: "Coati" })).not.toBe(key());
    expect(key({ lang: "pt" })).not.toBe(key());
  });

  it("separates entries by the parameters that change the answer", () => {
    expect(traceCacheKey({ ...BASE, claimText: "a longer sentence" })).not.toBe(
      key(),
    );
    expect(traceCacheKey({ ...BASE, maxPages: 5 })).not.toBe(key());
    expect(traceCacheKey({ ...BASE, searchBudgetMs: 1_000 })).not.toBe(key());
  });

  it("names the article and head revision in the clear, for debugging", () => {
    expect(key()).toContain("en:Quokka:1373272307");
  });
});

describe("redisResultStore", () => {
  it("round-trips a whole trace in one key", async () => {
    const { redis, store } = fakeRedis();
    const results = redisResultStore(redis);

    await results.set(key(), PROVENANCE);
    expect(store.size).toBe(1);
    expect(await results.get(key())).toEqual(PROVENANCE);
  });

  it("misses on a key for a different head revision", async () => {
    const { redis } = fakeRedis();
    const results = redisResultStore(redis);

    await results.set(key(), PROVENANCE);
    expect(await results.get(key({ headRevid: 999 }))).toBeUndefined();
  });

  it("stores compressed, not plaintext", async () => {
    const { redis, store } = fakeRedis();
    await redisResultStore(redis).set(key(), PROVENANCE);
    expect([...store.values()][0]).not.toContain("happiest animal");
  });
});

describe("guardedResultStore", () => {
  it("degrades to a miss and keeps the trace running when the store is dead", async () => {
    const dead = {
      async get(): Promise<undefined> {
        throw new Error("fetch failed");
      },
      async set(): Promise<void> {
        throw new Error("fetch failed");
      },
    };
    const breaker = createBreaker({ failureThreshold: 1 });
    const results = guardedResultStore(dead, breaker);

    expect(await results.get(key())).toBeUndefined();
    await expect(results.set(key(), PROVENANCE)).resolves.toBeUndefined();
    expect(breaker.health().state).toBe("open");
  });

  it("reports its outcomes on the result channel", async () => {
    const { redis } = fakeRedis();
    const seen: string[] = [];
    const results = guardedResultStore(
      redisResultStore(redis),
      createBreaker(),
      (channel, op, outcome) => void seen.push(`${channel}:${op}:${outcome}`),
    );

    await results.get(key());
    await results.set(key(), PROVENANCE);
    await results.get(key());

    expect(seen).toEqual([
      "result:read:miss",
      "result:write:ok",
      "result:read:hit",
    ]);
  });
});
