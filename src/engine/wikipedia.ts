import type { EngineCache } from "./cache.ts";

export interface RevisionMeta {
  revid: number;
  parentid: number;
  timestamp: string;
  user?: string;
  comment?: string;
  minor: boolean;
}

export type FetchJson = (url: string) => Promise<unknown>;

const USER_AGENT =
  "OriginTrace/0.1 (claim-provenance research; https://github.com/origin-trace)";

// Split a long history into this many concurrent time-windows, fetching this many
// at once. Measured sweep (Jupiter 8.9k revs): 24/12 halves listing wall vs the
// old 12/6 (7.8s→3.8s) with zero 429s and a byte-identical merged list; 24 windows
// keep each ≤1 page on typical articles, and 12-wide is as fast as 24-wide at half
// the connection pressure. `budget = maxPages/windowCount`, so total capacity (and
// the truncation threshold) is unchanged.
const WINDOW_COUNT = 24;
const WINDOW_CONCURRENCY = 12;
const WINDOW_BIAS = 2;
// Prefetch batches are only log-bounded in article size (~2·log₂(n) probes), not
// a fixed constant, so cap how many cache reads are in flight at once rather than
// opening one connection per revid.
const CACHE_READ_CONCURRENCY = 16;

export interface FetchJsonOptions {
  /** Fired before each backoff wait, for observability (e.g. a retry counter).
   *  `reason` is the HTTP status or the API error code that triggered the wait. */
  onRetry?: (info: { attempt: number; reason: string; waitMs: number }) => void;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Abort in-flight requests and cancel any pending backoff (e.g. when the
   *  client disconnects). Threaded to `fetch` and to the wait between retries. */
  signal?: AbortSignal;
}

/** HTTP statuses worth retrying: 429 (rate limit) and 503 (overload). */
const RETRYABLE_STATUS = new Set([429, 503]);
/** MediaWiki action-API error codes that mean "back off and retry". The API
 *  returns these in a **200** body (`{error:{code}}`) with a `Retry-After`
 *  header, not only as an HTTP status — so a status-only check would miss them. */
const RETRYABLE_API_ERROR = new Set(["maxlag", "ratelimited", "readonly"]);

interface ApiErrorShape {
  error?: { code?: string };
  errors?: Array<{ code?: string }>;
}

function abortError(): Error {
  return new DOMException("The operation was aborted.", "AbortError");
}

/** A backoff wait that resolves after `ms`, or rejects immediately if `signal`
 *  aborts — so a cancelled request never sits out its retry delay. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

/** Build a {@link FetchJson} that survives transient rate-limiting instead of
 *  aborting a whole trace. It retries on HTTP 429/503 **and** on the action
 *  API's in-body `maxlag`/`ratelimited` errors, honouring `Retry-After` and
 *  otherwise backing off exponentially with jitter. `fetchImpl` is injectable
 *  for tests; production uses the global `fetch`. The success path is unchanged
 *  — one request, parsed JSON. */
export function createFetchJson(
  opts: FetchJsonOptions = {},
  fetchImpl: typeof fetch = fetch,
): FetchJson {
  const maxRetries = opts.maxRetries ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 8000;

  return async (url) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: opts.signal,
      });

      // Decide retry vs. return vs. hard-fail. Two rate-limit shapes: an HTTP
      // status (429/503), or a 200 body carrying an action-API error code.
      let reason: string | null = null;
      let body: unknown;
      if (res.ok) {
        body = await res.json();
        const code =
          (body as ApiErrorShape)?.error?.code ??
          (body as ApiErrorShape)?.errors?.[0]?.code;
        if (code && RETRYABLE_API_ERROR.has(code)) reason = code;
        else return body;
      } else if (RETRYABLE_STATUS.has(res.status)) {
        reason = String(res.status);
      } else {
        throw new Error(
          `Wikipedia API ${res.status} ${res.statusText} for ${url}`,
        );
      }

      if (attempt >= maxRetries) {
        throw new Error(
          `Wikipedia API kept signalling "${reason}" after ${maxRetries} retries for ${url}`,
        );
      }

      const header = res.headers.get("retry-after");
      const retryAfterMs =
        header != null && Number.isFinite(Number(header))
          ? Number(header) * 1000
          : null;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const waitMs = retryAfterMs ?? backoff + Math.random() * backoff * 0.5;
      opts.onRetry?.({ attempt, reason, waitMs });
      await sleep(waitMs, opts.signal);
    }
  };
}

export const defaultFetchJson: FetchJson = createFetchJson();

export interface WikipediaClientOptions {
  lang?: string;
  fetchJson?: FetchJson;
  maxPages?: number;
  cache?: EngineCache;
  /** How many concurrent time-windows to split a long history into, and how many
   *  to fetch at once. Default to the module constants; overridable for tuning /
   *  experiments. Higher values shorten the critical path but raise concurrency
   *  against the API — the windows dedupe to the exact serial list either way. */
  windowCount?: number;
  windowConcurrency?: number;
}

export interface RevisionList {
  revisions: RevisionMeta[];
  truncated: boolean;
}

export class WikipediaClient {
  private readonly lang: string;
  private readonly fetchJson: FetchJson;
  private readonly maxPages: number;
  private readonly cache?: EngineCache;
  private readonly windowCount: number;
  private readonly windowConcurrency: number;

  constructor(opts: WikipediaClientOptions = {}) {
    this.lang = opts.lang ?? "en";
    this.fetchJson = opts.fetchJson ?? defaultFetchJson;
    this.maxPages = opts.maxPages ?? 200;
    this.cache = opts.cache;
    this.windowCount = opts.windowCount ?? WINDOW_COUNT;
    this.windowConcurrency = opts.windowConcurrency ?? WINDOW_CONCURRENCY;
  }

  private endpoint(params: Record<string, string>): string {
    const base = `https://${this.lang}.wikipedia.org/w/api.php`;
    const query = new URLSearchParams({
      format: "json",
      formatversion: "2",
      ...params,
    });
    return `${base}?${query.toString()}`;
  }

  async listRevisions(title: string): Promise<RevisionList> {
    const cached = await this.cache?.getList(this.lang, title);
    if (cached) return cached;

    const result = await this.fetchRevisionList(title);
    await this.cache?.setList(this.lang, title, result);
    return result;
  }

  private async fetchRevisionList(title: string): Promise<RevisionList> {
    const firstPage = await this.collectRange(title, {}, 1);
    if (!firstPage.continued) {
      return { revisions: firstPage.revisions, truncated: false };
    }

    const latest = await this.latestTimestamp(title);
    if (latest === null) {
      return { revisions: firstPage.revisions, truncated: firstPage.continued };
    }

    const startTs =
      firstPage.revisions[firstPage.revisions.length - 1]?.timestamp ?? "";

    const windows = planTimeWindows(startTs, latest, this.windowCount);
    if (windows.length === 0) {
      const rest = await this.collectRange(
        title,
        { start: startTs },
        this.maxPages,
      );
      return mergeRevisions(
        [firstPage.revisions, rest.revisions],
        rest.continued,
      );
    }

    const budget = Math.max(1, Math.floor(this.maxPages / windows.length));
    const parts = await mapConcurrent(windows, this.windowConcurrency, (w) =>
      this.collectRange(title, w, budget),
    );
    const truncated = parts.some((p) => p.continued);
    return mergeRevisions(
      [firstPage.revisions, ...parts.map((p) => p.revisions)],
      truncated,
    );
  }

  private async collectRange(
    title: string,
    window: { start?: string; end?: string },
    maxPages: number,
  ): Promise<{ revisions: RevisionMeta[]; continued: boolean }> {
    const revisions: RevisionMeta[] = [];
    let rvcontinue: string | undefined;
    let pages = 0;

    do {
      const params: Record<string, string> = {
        action: "query",
        prop: "revisions",
        titles: title,
        redirects: "1",
        rvprop: "ids|timestamp|comment",
        rvlimit: "max",
        rvdir: "newer",
      };
      if (window.start) params.rvstart = window.start;
      if (window.end) params.rvend = window.end;
      if (rvcontinue) params.rvcontinue = rvcontinue;

      const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
      const page = data.query?.pages?.[0];
      if (page?.missing) {
        throw new Error(
          `Article not found: "${title}" (${this.lang}.wikipedia)`,
        );
      }
      for (const r of page?.revisions ?? []) {
        revisions.push({
          revid: r.revid,
          parentid: r.parentid ?? 0,
          timestamp: r.timestamp ?? "",
          user: r.user,
          comment: r.comment,
          minor: Boolean(r.minor),
        });
      }
      rvcontinue = data.continue?.rvcontinue;
      pages += 1;
    } while (rvcontinue && pages < maxPages);

    return { revisions, continued: Boolean(rvcontinue) };
  }

  /** The timestamp of the current (newest) revision — the upper bound for windowing.
   *  One tiny request; `null` when the article somehow has no revisions. */
  private async latestTimestamp(title: string): Promise<string | null> {
    const params: Record<string, string> = {
      action: "query",
      prop: "revisions",
      titles: title,
      redirects: "1",
      rvprop: "timestamp",
      rvlimit: "1",
      rvdir: "older",
    };
    const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
    const page = data.query?.pages?.[0];
    if (page?.missing) {
      throw new Error(`Article not found: "${title}" (${this.lang}.wikipedia)`);
    }
    return page?.revisions?.[0]?.timestamp ?? null;
  }

  async getContent(revids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    for (let i = 0; i < revids.length; i += 50) {
      const batch = revids.slice(i, i + 50);

      let rvcontinue: string | undefined;
      do {
        const params: Record<string, string> = {
          action: "query",
          prop: "revisions",
          revids: batch.join("|"),
          rvprop: "ids|content",
          rvslots: "main",
        };
        if (rvcontinue) params.rvcontinue = rvcontinue;
        const data = (await this.fetchJson(
          this.endpoint(params),
        )) as ApiResponse;
        for (const page of data.query?.pages ?? []) {
          for (const r of page.revisions ?? []) {
            const content = r.slots?.main?.content;
            if (typeof content === "string") out.set(r.revid, content);
          }
        }
        rvcontinue = data.continue?.rvcontinue;
      } while (rvcontinue);
    }
    return out;
  }

  async getContentBatch(revids: number[]): Promise<Map<number, string | null>> {
    const out = new Map<number, string | null>();
    const unique = [...new Set(revids)];

    // Fan the cache reads out with bounded concurrency. A persistent L2
    // (Redis/KV) charges a round-trip per read, so awaiting them one at a time
    // was the batch's dominant cost — but the batch is only log-bounded in size,
    // so cap in-flight reads rather than open a connection per revid. Results
    // stay index-aligned; a cached `null` (known-empty) is distinct from a miss.
    const cached = await mapConcurrent(unique, CACHE_READ_CONCURRENCY, (revid) =>
      Promise.resolve(this.cache?.getContent(this.lang, revid)),
    );

    const misses: number[] = [];
    unique.forEach((revid, i) => {
      if (cached[i] !== undefined) out.set(revid, cached[i] as string | null);
      else misses.push(revid);
    });

    if (misses.length > 0) {
      const fetched = await this.getContent(misses);
      await Promise.all(
        misses.map((revid) => {
          const content = fetched.get(revid) ?? null;
          out.set(revid, content);
          return this.cache?.setContent(this.lang, revid, content);
        }),
      );
    }
    return out;
  }

  async getRevisionContent(revid: number): Promise<string | null> {
    const cached = await this.cache?.getContent(this.lang, revid);
    if (cached !== undefined) return cached;

    const map = await this.getContent([revid]);
    const content = map.get(revid) ?? null;
    await this.cache?.setContent(this.lang, revid, content);
    return content;
  }

  async getCurrentContent(
    title: string,
  ): Promise<{ revid: number; content: string; timestamp: string } | null> {
    const params: Record<string, string> = {
      action: "query",
      prop: "revisions",
      titles: title,
      redirects: "1",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      rvlimit: "1",
      rvdir: "older",
    };
    const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
    const page = data.query?.pages?.[0];
    if (page?.missing) {
      throw new Error(`Article not found: "${title}" (${this.lang}.wikipedia)`);
    }
    const rev = page?.revisions?.[0];
    const content = rev?.slots?.main?.content;
    if (!rev || typeof content !== "string") return null;
    await this.cache?.setContent(this.lang, rev.revid, content);
    return { revid: rev.revid, content, timestamp: rev.timestamp ?? "" };
  }

  async search(query: string, limit = 8): Promise<SearchHit[]> {
    const params: Record<string, string> = {
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(limit),
      srprop: "snippet",
      srnamespace: "0",
    };
    const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
    return (data.query?.search ?? []).map((h) => ({
      title: h.title,
      snippet: stripSnippet(h.snippet ?? ""),
    }));
  }
}

export interface SearchHit {
  title: string;
  snippet: string;
}

export function planTimeWindows(
  startTs: string,
  endTs: string,
  k: number,
): Array<{ start: string; end: string }> {
  const startMs = Date.parse(startTs);
  const endMs = Date.parse(endTs);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return [];
  }

  const windows: Array<{ start: string; end: string }> = [];
  let prev = startMs;
  for (let i = 1; i <= k; i++) {
    const frac = 1 - Math.pow(1 - i / k, WINDOW_BIAS); // 0→1, gaps shrink toward endMs
    const boundary =
      i === k ? endMs : Math.round(startMs + (endMs - startMs) * frac);
    if (boundary > prev) {
      windows.push({ start: msToIso(prev), end: msToIso(boundary) });
      prev = boundary;
    }
  }
  return windows;
}

/** Union several (possibly overlapping) revision batches into one canonically
 *  ordered list: dedupe by revid, then sort by (timestamp, revid) ascending — the
 *  exact order the API returns for a serial `rvdir=newer` walk. This is what makes
 *  windowed and serial pagination provably interchangeable. Exported for tests. */
export function mergeRevisions(
  batches: RevisionMeta[][],
  truncated: boolean,
): RevisionList {
  const byId = new Map<number, RevisionMeta>();
  for (const batch of batches) {
    for (const r of batch) if (!byId.has(r.revid)) byId.set(r.revid, r);
  }
  const revisions = [...byId.values()].sort((a, b) =>
    a.timestamp < b.timestamp
      ? -1
      : a.timestamp > b.timestamp
        ? 1
        : a.revid - b.revid,
  );
  return { revisions, truncated };
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);

  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  const size = Math.min(limit, items.length);

  await Promise.all(Array.from({ length: size }, () => worker()));

  return results;
}

function stripSnippet(html: string): string {
  let s = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  s = s
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]*>/g, "");

  let prev: string;
  do {
    prev = s;
    s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  } while (s !== prev);
  s = s.replace(/^[^{}]*\}\}/, "").replace(/\{\{[^{}]*$/, "");

  return (
    s
      .replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]/g, "$1")
      .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
      .replace(/\[https?:\/\/\S+\]/g, "")
      .replace(/\[\[|\]\]/g, "")
      .replace(/={2,}\s*([^=]*?)\s*={2,}/g, "$1")
      .replace(/'{2,}/g, "")
      .replace(/(^|\s)[*#]+\s*/g, "$1")
      .replace(/\{\||\|\}|\|[-+]/g, " ")
      .replace(/\s*\|\s*/g, " ")
      .replace(/\s+([.,;:)])/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}

interface ApiRevision {
  revid: number;
  parentid?: number;
  timestamp?: string;
  user?: string;
  comment?: string;
  minor?: boolean;
  slots?: { main?: { content?: string } };
}

interface ApiPage {
  missing?: boolean;
  revisions?: ApiRevision[];
}

interface ApiSearchHit {
  title: string;
  snippet?: string;
}

interface ApiResponse {
  query?: { pages?: ApiPage[]; search?: ApiSearchHit[] };
  continue?: { rvcontinue?: string };
}
