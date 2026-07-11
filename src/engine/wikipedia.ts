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

const WINDOW_COUNT = 12;
const WINDOW_CONCURRENCY = 6;
const WINDOW_BIAS = 2;

const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Wikipedia API ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
};

export interface WikipediaClientOptions {
  lang?: string;
  fetchJson?: FetchJson;
  maxPages?: number;
  cache?: EngineCache;
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

  constructor(opts: WikipediaClientOptions = {}) {
    this.lang = opts.lang ?? "en";
    this.fetchJson = opts.fetchJson ?? defaultFetchJson;
    this.maxPages = opts.maxPages ?? 200;
    this.cache = opts.cache;
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

    const windows = planTimeWindows(startTs, latest, WINDOW_COUNT);
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
    const parts = await mapConcurrent(windows, WINDOW_CONCURRENCY, (w) =>
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
    const misses = new Set<number>();
    for (const revid of revids) {
      if (out.has(revid) || misses.has(revid)) continue;
      const cached = await this.cache?.getContent(this.lang, revid);
      if (cached !== undefined) out.set(revid, cached);
      else misses.add(revid);
    }
    if (misses.size > 0) {
      const fetched = await this.getContent([...misses]);
      await Promise.all(
        [...misses].map((revid) => {
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
