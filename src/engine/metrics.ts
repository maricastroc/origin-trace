import type { EngineCache } from "./cache.ts";
import type {
  CacheChannel as GuardChannel,
  CacheHealth,
  CacheOp,
  CacheOutcome,
} from "./cache-guard.ts";
import type { FetchJson, RevisionList } from "./wikipedia.ts";

export type Stage = "listing" | "search" | "read" | "genealogy" | "assemble";

export type RequestKind =
  "list" | "content" | "current" | "latest-ts" | "search" | "other";

export interface CacheChannel {
  reads: number;
  hits: number;
  misses: number;
  readMs: number;
  writes: number;
  writeMs: number;
}

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
    result: CacheChannel;
    health?: CacheHealth;
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
    byKind: {} as Partial<
      Record<RequestKind, { requests: number; ms: number }>
    >,
  };
  private readonly cacheContent = emptyChannel();
  private readonly cacheList = emptyChannel();
  private readonly cacheResult = emptyChannel();
  private cacheHealth: (() => CacheHealth) | null = null;

  readonly onStage = (stage: Stage): void => {
    const t = clock();
    this.stages[stage] = (this.stages[stage] ?? 0) + (t - this.lastMarkAt);
    this.lastMarkAt = t;
  };

  readonly recordRetry = (): void => {
    this.net.retries++;
  };

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

  readonly onCacheOutcome = (
    channel: GuardChannel,
    op: CacheOp,
    outcome: CacheOutcome,
    ms: number,
  ): void => {
    if (channel !== "result") return;
    if (op === "read") {
      this.cacheResult.reads++;
      this.cacheResult.readMs += ms;
      if (outcome === "hit") this.cacheResult.hits++;
      else if (outcome === "miss") this.cacheResult.misses++;
    } else {
      this.cacheResult.writes++;
      this.cacheResult.writeMs += ms;
    }
  };

  attachCacheHealth(health: () => CacheHealth): void {
    this.cacheHealth = health;
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
        result: { ...this.cacheResult },
        ...(this.cacheHealth ? { health: this.cacheHealth() } : {}),
      },
    };
  }

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
      `cache;dur=${cacheMs.toFixed(1)};desc="${m.cache.content.hits}h/${m.cache.content.misses}m/${m.cache.health?.state ?? "none"}"`,
    );
    parts.push(`total;dur=${m.wallMs.toFixed(1)}`);
    return parts.join(", ");
  }
}
