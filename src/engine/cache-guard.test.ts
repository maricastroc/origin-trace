import { describe, expect, it } from "vitest";
import {
  createBreaker,
  guardedCache,
  type CacheChannel,
  type CacheOp,
  type CacheOutcome,
} from "@/engine/cache-guard.ts";
import type { EngineCache } from "@/engine/cache.ts";
import type { RevisionList } from "@/engine/wikipedia.ts";

const LIST: RevisionList = {
  revisions: [
    { revid: 1, parentid: 0, timestamp: "2004-01-01T00:00:00Z", minor: false },
  ],
  truncated: false,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A store whose every operation behaves the way the dead Upstash instance did:
 *  it takes `ms` and then throws. Counts calls so a test can prove the breaker
 *  stopped reaching it. */
function failingStore(ms = 0) {
  let calls = 0;
  const boom = async (): Promise<never> => {
    calls++;
    if (ms > 0) await sleep(ms);
    throw new Error("fetch failed");
  };
  const cache: EngineCache = {
    getContent: boom,
    setContent: boom,
    getList: boom,
    setList: boom,
  };
  return {
    cache,
    get calls() {
      return calls;
    },
  };
}

function workingStore() {
  let calls = 0;
  const cache: EngineCache = {
    async getContent() {
      calls++;
      return "content";
    },
    async setContent() {
      calls++;
    },
    async getList() {
      calls++;
      return LIST;
    },
    async setList() {
      calls++;
    },
  };
  return {
    cache,
    get calls() {
      return calls;
    },
  };
}

type Event = [CacheChannel, CacheOp, CacheOutcome];

function recorder() {
  const events: Event[] = [];
  return {
    events,
    observe: (c: CacheChannel, o: CacheOp, outcome: CacheOutcome) =>
      void events.push([c, o, outcome]),
  };
}

describe("guardedCache", () => {
  it("falls back to a miss when the store throws, without rejecting", async () => {
    const store = failingStore();
    const cache = guardedCache(store.cache, { failureThreshold: 99 });

    expect(await cache.getContent("en", 1)).toBeUndefined();
    expect(await cache.getList("en", "T")).toBeUndefined();
    await expect(cache.setContent("en", 1, "x")).resolves.toBeUndefined();
    await expect(cache.setList("en", "T", LIST)).resolves.toBeUndefined();
  });

  it("abandons an operation that exceeds the timeout", async () => {
    const slow: EngineCache = {
      async getContent() {
        await sleep(400);
        return "too late";
      },
      async setContent() {},
      async getList() {
        return undefined;
      },
      async setList() {},
    };
    const cache = guardedCache(slow, { timeoutMs: 25 });

    const started = Date.now();
    expect(await cache.getContent("en", 1)).toBeUndefined();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(200);
    expect(cache.health().outcomes.timeout).toBe(1);
  });

  it("counts a timeout as a timeout, not as a miss", async () => {
    const slow: EngineCache = {
      async getContent() {
        await sleep(400);
        return "too late";
      },
      async setContent() {},
      async getList() {
        return undefined;
      },
      async setList() {},
    };
    const { events, observe } = recorder();
    const cache = guardedCache(slow, { timeoutMs: 25 }, observe);

    await cache.getContent("en", 1);

    expect(events).toEqual([["content", "read", "timeout"]]);
    expect(cache.health().outcomes.miss).toBe(0);
  });

  it("opens after the failure threshold and then stops calling the store", async () => {
    const store = failingStore();
    const cache = guardedCache(store.cache, { failureThreshold: 2 });

    await cache.getContent("en", 1);
    await cache.getContent("en", 2);
    expect(store.calls).toBe(2);
    expect(cache.health().state).toBe("open");

    for (let i = 0; i < 20; i++) await cache.getContent("en", 100 + i);

    expect(store.calls).toBe(2);
    expect(cache.health().outcomes.bypass).toBe(20);
    expect(cache.health().trips).toBe(1);
  });

  it("records a bypass as a bypass, never as an ordinary miss", async () => {
    const store = failingStore();
    const { events, observe } = recorder();
    const cache = guardedCache(store.cache, { failureThreshold: 1 }, observe);

    await cache.getContent("en", 1);
    await cache.getContent("en", 2);

    expect(events).toEqual([
      ["content", "read", "error"],
      ["content", "read", "bypass"],
    ]);
    const { outcomes } = cache.health();
    expect(outcomes.miss).toBe(0);
    expect(outcomes.error).toBe(1);
    expect(outcomes.bypass).toBe(1);
  });

  it("charges nothing in wall-clock for a bypassed operation", async () => {
    const store = failingStore(50);
    const cache = guardedCache(store.cache, { failureThreshold: 1 });

    await cache.getContent("en", 1);
    const before = cache.health().waitedMs;

    for (let i = 0; i < 10; i++) await cache.getContent("en", 100 + i);

    expect(cache.health().waitedMs).toBe(before);
  });

  it("distinguishes hit from miss while the circuit is closed", async () => {
    const { events, observe } = recorder();
    const cache = guardedCache(
      {
        async getContent(_lang, revid) {
          return revid === 1 ? "here" : undefined;
        },
        async setContent() {},
        async getList() {
          return undefined;
        },
        async setList() {},
      },
      {},
      observe,
    );

    await cache.getContent("en", 1);
    await cache.getContent("en", 2);

    expect(events).toEqual([
      ["content", "read", "hit"],
      ["content", "read", "miss"],
    ]);
    expect(cache.health().state).toBe("closed");
  });

  it("lets one trial through after the cooldown and closes on success", async () => {
    let failing = true;
    let calls = 0;
    const flaky: EngineCache = {
      async getContent() {
        calls++;
        if (failing) throw new Error("fetch failed");
        return "recovered";
      },
      async setContent() {},
      async getList() {
        return undefined;
      },
      async setList() {},
    };

    let clock = 0;
    const cache = guardedCache(flaky, {
      failureThreshold: 1,
      cooldownMs: 1_000,
      now: () => clock,
    });

    await cache.getContent("en", 1);
    expect(cache.health().state).toBe("open");

    clock = 500;
    await cache.getContent("en", 2);
    expect(calls).toBe(1);

    clock = 1_500;
    failing = false;
    expect(await cache.getContent("en", 3)).toBe("recovered");
    expect(calls).toBe(2);
    expect(cache.health().state).toBe("closed");
    expect(cache.health().consecutiveFailures).toBe(0);
  });

  it("reopens when the trial fails again", async () => {
    const store = failingStore();
    let clock = 0;
    const cache = guardedCache(store.cache, {
      failureThreshold: 1,
      cooldownMs: 1_000,
      now: () => clock,
    });

    await cache.getContent("en", 1);
    clock = 2_000;
    await cache.getContent("en", 2);
    expect(store.calls).toBe(2);
    expect(cache.health().state).toBe("open");

    clock = 2_100;
    await cache.getContent("en", 3);
    expect(store.calls).toBe(2);
  });

  it("shares one breaker across every client of the same store", async () => {
    const store = failingStore();
    const breaker = createBreaker({ failureThreshold: 1 });

    const a = guardedCache(store.cache, breaker);
    const b = guardedCache(store.cache, breaker);

    await a.getContent("en", 1);
    await b.getList("en", "T");

    expect(store.calls).toBe(1);
    expect(b.health().outcomes.bypass).toBe(1);
  });

  it("leaves a healthy store completely unguarded in behaviour", async () => {
    const store = workingStore();
    const cache = guardedCache(store.cache);

    expect(await cache.getContent("en", 1)).toBe("content");
    expect(await cache.getList("en", "T")).toEqual(LIST);
    await cache.setContent("en", 1, "x");
    await cache.setList("en", "T", LIST);

    expect(store.calls).toBe(4);
    const { state, outcomes } = cache.health();
    expect(state).toBe("closed");
    expect(outcomes.error + outcomes.timeout + outcomes.bypass).toBe(0);
  });
});
