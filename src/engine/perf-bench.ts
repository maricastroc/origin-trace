import { createEngineCache, tieredCache, type EngineCache } from "./cache.ts";
import { TraceProfiler } from "./metrics.ts";
import { createFetchJson } from "./wikipedia.ts";
import { ClaimNotFoundError, traceClaim } from "./trace.ts";

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return list.get(`${lang}:${title}`) as any;
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

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const mode = (args[args.indexOf("--mode") + 1] ?? "dead") as
    "dead" | "none" | "live";
  const only = args.includes("--case")
    ? args[args.indexOf("--case") + 1]
    : null;

  const rows: Record<string, unknown>[] = [];

  for (const c of CASES) {
    if (only && c.name !== only) continue;

    const l2 =
      mode === "dead" ? deadRedis() : mode === "live" ? liveRedis() : null;
    const cache = l2
      ? tieredCache(createEngineCache(), l2)
      : createEngineCache();

    const profiler = new TraceProfiler();
    const started = performance.now();
    let outcome = "ok";
    try {
      await traceClaim({
        article: c.article,
        phrase: c.phrase,
        cache: profiler.instrumentCache(cache),
        fetchJson: profiler.instrumentFetch(
          createFetchJson({ onRetry: profiler.recordRetry }),
        ),
        onStage: profiler.onStage,
      });
    } catch (err) {
      outcome = err instanceof ClaimNotFoundError ? "not-found" : "error";
    }
    const wall = performance.now() - started;
    const m = profiler.snapshot();

    rows.push({
      case: c.name,
      mode,
      outcome,
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
    });
  }

  process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
}

main(process.argv);
