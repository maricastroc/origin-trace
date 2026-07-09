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

    const revisions: RevisionMeta[] = [];
    let rvcontinue: string | undefined;
    let pages = 0;

    do {
      const params: Record<string, string> = {
        action: "query",
        prop: "revisions",
        titles: title,
        rvprop: "ids|timestamp|comment",
        rvlimit: "max",
        rvdir: "newer",
      };
      if (rvcontinue) params.rvcontinue = rvcontinue;

      const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
      const page = data.query?.pages?.[0];
      if (page?.missing) {
        throw new Error(`Article not found: "${title}" (${this.lang}.wikipedia)`);
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
    } while (rvcontinue && pages < this.maxPages);

    const result: RevisionList = { revisions, truncated: Boolean(rvcontinue) };
    await this.cache?.setList(this.lang, title, result);
    return result;
  }

  async getContent(revids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    for (let i = 0; i < revids.length; i += 50) {
      const batch = revids.slice(i, i + 50);
      const params: Record<string, string> = {
        action: "query",
        prop: "revisions",
        revids: batch.join("|"),
        rvprop: "ids|content",
        rvslots: "main",
      };
      const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
      for (const page of data.query?.pages ?? []) {
        for (const r of page.revisions ?? []) {
          const content = r.slots?.main?.content;
          if (typeof content === "string") out.set(r.revid, content);
        }
      }
    }
    return out;
  }

  /** Resolve content for many revids in as few round-trips as possible. Revisions
   *  are immutable, so a cached body is authoritative; only the misses hit the
   *  network (batched 50/request by getContent). Both the cache reads and writes
   *  go through the shared EngineCache, so a warmed revision is never refetched
   *  across traces. Used to prime the cache ahead of a binary-search probe sweep,
   *  collapsing what would be N sequential single-revision fetches into one call. */
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

function stripSnippet(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
