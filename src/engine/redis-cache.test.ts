import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import { RedisEngineCache } from "@/engine/redis-cache.ts";
import type { RevisionList } from "@/engine/wikipedia.ts";

// Minimal stand-in for Upstash Redis: RedisEngineCache stores a gzip+base64 string
// via `set` and reads it back with `get<string>`, so the fake just needs a string
// keystore. `ex` is recorded so we can assert the TTL split (content vs list).
function fakeRedis() {
  const store = new Map<string, string>();
  const ttl = new Map<string, number | undefined>();
  const redis = {
    async get<T>(key: string): Promise<T | null> {
      return (store.has(key) ? (store.get(key) as unknown as T) : null);
    },
    async set(key: string, value: string, opts?: { ex?: number }) {
      store.set(key, value);
      ttl.set(key, opts?.ex);
      return "OK";
    },
  };
  return { redis: redis as unknown as Redis, store, ttl };
}

const list: RevisionList = {
  revisions: [
    { revid: 10, parentid: 0, timestamp: "2004-01-01T00:00:00Z", minor: false },
    { revid: 11, parentid: 10, timestamp: "2004-02-01T00:00:00Z", minor: true },
  ],
  truncated: false,
};

describe("RedisEngineCache", () => {
  it("round-trips content through gzip", async () => {
    const { redis } = fakeRedis();
    const cache = new RedisEngineCache(redis);
    await cache.setContent("en", 42, "hello {{cite}} world");
    expect(await cache.getContent("en", 42)).toBe("hello {{cite}} world");
  });

  it("stores compressed, not plaintext", async () => {
    const { redis, store } = fakeRedis();
    const cache = new RedisEngineCache(redis);
    await cache.setContent("en", 1, "PLAINTEXT_MARKER repeated ".repeat(50));
    const stored = [...store.values()][0];
    expect(stored).not.toContain("PLAINTEXT_MARKER");
  });

  it("distinguishes a miss from a cached null", async () => {
    const { redis } = fakeRedis();
    const cache = new RedisEngineCache(redis);
    expect(await cache.getContent("en", 99)).toBeUndefined(); // miss
    await cache.setContent("en", 99, null);
    expect(await cache.getContent("en", 99)).toBeNull(); // deliberately empty
  });

  it("round-trips a revision list", async () => {
    const { redis } = fakeRedis();
    const cache = new RedisEngineCache(redis);
    await cache.setList("pt", "Quokka", list);
    expect(await cache.getList("pt", "Quokka")).toEqual(list);
  });

  it("gives content a long TTL and lists a short one", async () => {
    const { redis, ttl } = fakeRedis();
    const cache = new RedisEngineCache(redis);
    await cache.setContent("en", 1, "x");
    await cache.setList("en", "T", list);
    const [contentTtl, listTtl] = [...ttl.values()];
    expect(contentTtl).toBeGreaterThan(listTtl!);
  });

  it("degrades to a miss / no-op when Redis throws", async () => {
    const boom = {
      async get() {
        throw new Error("redis down");
      },
      async set() {
        throw new Error("redis down");
      },
    } as unknown as Redis;
    const cache = new RedisEngineCache(boom);
    await expect(cache.setContent("en", 1, "x")).resolves.toBeUndefined();
    expect(await cache.getContent("en", 1)).toBeUndefined();
    expect(await cache.getList("en", "T")).toBeUndefined();
  });
});
