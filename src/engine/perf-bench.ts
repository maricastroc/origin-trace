import {
  createEngineCache,
  listOnlyTiered,
  tieredCache,
  type EngineCache,
} from "./cache.ts";
import {
  createBreaker,
  guardedCache,
  type CacheHealth,
} from "./cache-guard.ts";
import { TraceProfiler } from "./metrics.ts";
import { WikipediaClient, createFetchJson } from "./wikipedia.ts";
import {
  ClaimNotFoundError,
  SearchIncompleteError,
  traceClaim,
} from "./trace.ts";
import { traceCacheKey } from "./result-cache.ts";
import type { ClaimProvenance } from "@/types/ClaimProvenance";

export const UPSTASH_DEAD_OP_MS = [0, 1, 2, 3, 4].reduce(
  (sum, i) => sum + Math.exp(i) * 50,
  0,
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function deadRedis(opMs = UPSTASH_DEAD_OP_MS): EngineCache {
  return {
    async getContent() {
      await sleep(opMs);
      return undefined;
    },
    async setContent() {
      await sleep(opMs);
    },
    async getList() {
      await sleep(opMs);
      return undefined;
    },
    async setList() {
      await sleep(opMs);
    },
  };
}

function deadThrowingRedis(opMs = UPSTASH_DEAD_OP_MS): EngineCache {
  const fail = async (): Promise<never> => {
    await sleep(opMs);
    throw new Error("fetch failed");
  };
  return { getContent: fail, setContent: fail, getList: fail, setList: fail };
}

function liveRedis(rttMs = 25): EngineCache {
  const content = new Map<string, string | null>();
  const list = new Map<string, unknown>();
  return {
    async getContent(lang, revid) {
      await sleep(rttMs);
      const k = `${lang}:${revid}`;
      return content.has(k) ? (content.get(k) as string | null) : undefined;
    },
    async setContent(lang, revid, value) {
      await sleep(rttMs);
      content.set(`${lang}:${revid}`, value);
    },
    async getList(lang, title) {
      await sleep(rttMs);
      return list.get(`${lang}:${title}`) as never;
    },
    async setList(lang, title, value) {
      await sleep(rttMs);
      list.set(`${lang}:${title}`, value);
    },
  };
}

const CASES = [
  {
    name: "petasites",
    article: "Petasites",
    phrase: "pyrrolizidine alkaloids",
  },
  { name: "quokka", article: "Quokka", phrase: "happiest animal" },
];

type Mode =
  "dead" | "fixed-dead" | "none" | "live" | "fixed-live" | "result-hit";

function wire(mode: Mode): {
  cache: EngineCache;
  health: (() => CacheHealth) | null;
} {
  switch (mode) {
    case "dead":
      return {
        cache: tieredCache(createEngineCache(), deadRedis()),
        health: null,
      };
    case "live":
      return {
        cache: tieredCache(createEngineCache(), liveRedis()),
        health: null,
      };
    case "fixed-dead":
    case "fixed-live": {
      const breaker = createBreaker();
      const store = mode === "fixed-dead" ? deadThrowingRedis() : liveRedis();
      return {
        cache: listOnlyTiered(
          createEngineCache(),
          guardedCache(store, breaker),
        ),
        health: breaker.health,
      };
    }
    default:
      return { cache: createEngineCache(), health: null };
  }
}

async function measureResultHit(c: {
  name: string;
  article: string;
  phrase: string;
}): Promise<Record<string, unknown>> {
  const store = new Map<string, ClaimProvenance>();
  const rttMs = 25;

  const cold = new TraceProfiler();
  const coldStarted = performance.now();
  const client = new WikipediaClient({
    fetchJson: cold.instrumentFetch(createFetchJson()),
    cache: createEngineCache(),
  });
  const head = await client.latestRevision(c.article);
  const provenance = await traceClaim({
    article: c.article,
    phrase: c.phrase,
    cache: cold.instrumentCache(createEngineCache()),
    fetchJson: cold.instrumentFetch(createFetchJson()),
    onStage: cold.onStage,
  });
  const coldMs = performance.now() - coldStarted;

  const key = traceCacheKey({
    lang: "en",
    article: c.article,
    headRevid: head!.revid,
    phrase: c.phrase,
  });
  store.set(key, provenance);

  const warm = new TraceProfiler();
  const warmStarted = performance.now();
  const warmClient = new WikipediaClient({
    fetchJson: warm.instrumentFetch(createFetchJson()),
    cache: createEngineCache(),
  });
  const head2 = await warmClient.latestRevision(c.article);
  const key2 = traceCacheKey({
    lang: "en",
    article: c.article,
    headRevid: head2!.revid,
    phrase: c.phrase,
  });
  await sleep(rttMs);
  const hit = store.get(key2);
  const warmMs = performance.now() - warmStarted;

  return {
    case: c.name,
    mode: "result-hit",
    hit: hit !== undefined,
    coldWallMs: Math.round(coldMs),
    warmWallMs: Math.round(warmMs),
    warmWikiRequests: warm.snapshot().network.requests,
    warmWikiMs: Math.round(warm.snapshot().network.ms),
    storeReadMs: rttMs,
  };
}

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const mode = (args[args.indexOf("--mode") + 1] ?? "dead") as Mode;
  const only = args.includes("--case")
    ? args[args.indexOf("--case") + 1]
    : null;

  const valid: Mode[] = [
    "dead",
    "fixed-dead",
    "none",
    "live",
    "fixed-live",
    "result-hit",
  ];
  if (!valid.includes(mode)) {
    process.stderr.write(
      `Unknown --mode ${mode}. One of: ${valid.join(", ")}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const rows: Record<string, unknown>[] = [];

  if (mode === "result-hit") {
    for (const c of CASES) {
      if (only && c.name !== only) continue;
      rows.push(await measureResultHit(c));
    }
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  for (const c of CASES) {
    if (only && c.name !== only) continue;

    const { cache, health } = wire(mode);
    const profiler = new TraceProfiler();
    if (health) profiler.attachCacheHealth(health);

    const started = performance.now();
    let outcome = "ok";
    let searchTruncated: boolean | null = null;
    try {
      const result = await traceClaim({
        article: c.article,
        phrase: c.phrase,
        cache: profiler.instrumentCache(cache),
        fetchJson: profiler.instrumentFetch(
          createFetchJson({ onRetry: profiler.recordRetry }),
        ),
        onStage: profiler.onStage,
      });
      searchTruncated = result.search?.searchTruncated ?? null;
    } catch (err) {
      outcome =
        err instanceof SearchIncompleteError
          ? "incomplete"
          : err instanceof ClaimNotFoundError
            ? "not-found"
            : "error";
    }
    const wall = performance.now() - started;
    const m = profiler.snapshot();

    rows.push({
      case: c.name,
      mode,
      outcome,
      searchTruncated,
      wallMs: Math.round(wall),
      listingMs: Math.round(m.stages.listing ?? 0),
      searchMs: Math.round(m.stages.search ?? 0),
      genealogyMs: Math.round(m.stages.genealogy ?? 0),
      wikiRequests: m.network.requests,
      wikiMs: Math.round(m.network.ms),
      contentBatches: m.network.contentBatches,
      revisionsFetched: m.network.revisionsFetched,
      cacheReads: m.cache.content.reads + m.cache.list.reads,
      cacheHits: m.cache.content.hits + m.cache.list.hits,
      cacheMisses: m.cache.content.misses + m.cache.list.misses,
      cacheWrites: m.cache.content.writes + m.cache.list.writes,
      cacheMsCumulative: Math.round(
        m.cache.content.readMs +
          m.cache.content.writeMs +
          m.cache.list.readMs +
          m.cache.list.writeMs,
      ),
      ...(m.cache.health
        ? {
            breakerState: m.cache.health.state,
            breakerTrips: m.cache.health.trips,
            storeOps: Object.values(m.cache.health.outcomes).reduce(
              (a, b) => a + b,
              0,
            ),
            storeWaitedMs: Math.round(m.cache.health.waitedMs),
            storeOutcomes: m.cache.health.outcomes,
          }
        : {}),
    });
  }

  process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
}

main(process.argv);
