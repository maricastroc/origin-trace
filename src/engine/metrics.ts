import type { EngineCache } from "./cache.ts";
import type { FetchJson, RevisionList } from "./wikipedia.ts";

/** Coarse pipeline stages, in the order a trace runs them. */
export type Stage = "listing" | "search" | "read" | "genealogy" | "assemble";

export type RequestKind =
  | "list"
  | "content"
  | "current"
  | "latest-ts"
  | "search"
  | "other";

export interface CacheChannel {
  reads: number;
  hits: number;
  misses: number;
  readMs: number;
  writes: number;
  writeMs: number;
}

/** Everything one trace or audit spent its wall-clock on, measured at the two
 *  external seams (the Wikipedia fetch and the {@link EngineCache}) plus coarse
 *  stage marks. Purely observational — see {@link TraceProfiler}. */
export interface TraceMetrics {
  wallMs: number;
  stages: Partial<Record<Stage, number>>;
  network: {
    requests: number;
    ms: number;
    retries: number;
    contentBatches: number;
    revisionsFetched: number;
    byKind: Partial<Record<RequestKind, { requests: number; ms: number }>>;
  };
  cache: {
    content: CacheChannel;
    list: CacheChannel;
  };
}

function emptyChannel(): CacheChannel {
  return { reads: 0, hits: 0, misses: 0, readMs: 0, writes: 0, writeMs: 0 };
}

export function classifyRequest(url: string): RequestKind {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return "other";
  }
  if (params.get("list") === "search") return "search";
  if (params.get("revids")) return "content";
  if (params.get("rvlimit") === "1") {
    return (params.get("rvprop") ?? "").includes("content")
      ? "current"
      : "latest-ts";
  }
  if (params.get("prop") === "revisions") return "list";
  return "other";
}

function countRevids(url: string): number {
  try {
    const revids = new URL(url).searchParams.get("revids");
    return revids ? revids.split("|").length : 0;
  } catch {
    return 0;
  }
}

const clock = (): number => performance.now();

/**
 * A request-scoped profiler for one trace or audit. It wraps the pipeline's two
 * external seams — {@link FetchJson} and {@link EngineCache} — and collects
 * coarse stage marks, so a route can report exactly where the wall-clock went
 * (Wikipedia latency vs. cache latency vs. per-stage time, request and batch
 * counts, cache hit/miss) without the engine knowing it is being watched.
 *
 * Strictly additive: with no profiler the pipeline runs unchanged, and the
 * wrappers only observe — they never alter results, order, or error behaviour.
 */
export class TraceProfiler {
  private readonly startedAt = clock();
  private lastMarkAt = this.startedAt;
  private readonly stages: Partial<Record<Stage, number>> = {};
  private readonly net = {
    requests: 0,
    ms: 0,
    retries: 0,
    contentBatches: 0,
    revisionsFetched: 0,
    byKind: {} as Partial<Record<RequestKind, { requests: number; ms: number }>>,
  };
  private readonly cacheContent = emptyChannel();
  private readonly cacheList = emptyChannel();

  /** Close the stage that just ended and start timing the next one. Call only
   *  at the coarse boundaries in {@link traceClaim}/{@link auditArticle}. */
  readonly onStage = (stage: Stage): void => {
    const t = clock();
    this.stages[stage] = (this.stages[stage] ?? 0) + (t - this.lastMarkAt);
    this.lastMarkAt = t;
  };

  /** Count a retry a backoff-aware fetch performed. No-op with the default
   *  fetch (it doesn't retry) — wired for the later concurrency/backoff work. */
  readonly recordRetry = (): void => {
    this.net.retries++;
  };

  /** Wrap a {@link FetchJson} so every Wikipedia call is counted and timed by
   *  kind. Latency here is real network time (cache hits never reach it). */
  instrumentFetch(inner: FetchJson): FetchJson {
    return async (url) => {
      const kind = classifyRequest(url);
      const started = clock();
      const out = await inner(url);
      const dt = clock() - started;
      this.net.requests++;
      this.net.ms += dt;
      const bucket = (this.net.byKind[kind] ??= { requests: 0, ms: 0 });
      bucket.requests++;
      bucket.ms += dt;
      if (kind === "content") {
        this.net.contentBatches++;
        this.net.revisionsFetched += countRevids(url);
      }
      return out;
    };
  }

  /** Wrap an {@link EngineCache} so hits/misses and cumulative read/write
   *  latency are recorded per channel. This is the seam where a Redis/KV L2's
   *  per-call round-trips show up as cache latency. */
  instrumentCache(inner: EngineCache): EngineCache {
    const content = this.cacheContent;
    const list = this.cacheList;
    return {
      async getContent(lang, revid) {
        const started = clock();
        const v = await inner.getContent(lang, revid);
        content.readMs += clock() - started;
        content.reads++;
        if (v === undefined) content.misses++;
        else content.hits++;
        return v;
      },
      async setContent(lang, revid, value) {
        const started = clock();
        await inner.setContent(lang, revid, value);
        content.writeMs += clock() - started;
        content.writes++;
      },
      async getList(lang, title): Promise<RevisionList | undefined> {
        const started = clock();
        const v = await inner.getList(lang, title);
        list.readMs += clock() - started;
        list.reads++;
        if (v === undefined) list.misses++;
        else list.hits++;
        return v;
      },
      async setList(lang, title, value) {
        const started = clock();
        await inner.setList(lang, title, value);
        list.writeMs += clock() - started;
        list.writes++;
      },
    };
  }

  snapshot(): TraceMetrics {
    return {
      wallMs: clock() - this.startedAt,
      stages: { ...this.stages },
      network: {
        requests: this.net.requests,
        ms: this.net.ms,
        retries: this.net.retries,
        contentBatches: this.net.contentBatches,
        revisionsFetched: this.net.revisionsFetched,
        byKind: { ...this.net.byKind },
      },
      cache: {
        content: { ...this.cacheContent },
        list: { ...this.cacheList },
      },
    };
  }

  /** Format a W3C `Server-Timing` header value. Only meaningful on a
   *  non-streaming response, whose headers are sent after the work completes. */
  serverTiming(): string {
    const m = this.snapshot();
    const parts: string[] = [];
    for (const stage of ["listing", "search", "read", "genealogy"] as Stage[]) {
      const ms = m.stages[stage];
      if (ms !== undefined) parts.push(`${stage};dur=${ms.toFixed(1)}`);
    }
    parts.push(
      `wiki;dur=${m.network.ms.toFixed(1)};desc="${m.network.requests}req/${m.network.revisionsFetched}rev"`,
    );
    const cacheMs =
      m.cache.content.readMs +
      m.cache.content.writeMs +
      m.cache.list.readMs +
      m.cache.list.writeMs;
    parts.push(
      `cache;dur=${cacheMs.toFixed(1)};desc="${m.cache.content.hits}h/${m.cache.content.misses}m"`,
    );
    parts.push(`total;dur=${m.wallMs.toFixed(1)}`);
    return parts.join(", ");
  }
}
