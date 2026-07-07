/**
 * Thin typed client for the MediaWiki Action API.
 *
 * The engine's only door to the outside world. Everything downstream
 * (blame, trace) is pure and operates on the data this returns, so it can be
 * unit-tested against recorded fixtures by swapping the `fetchJson` transport.
 */
import type { EngineCache } from "./cache.ts";

/** One revision's metadata — the cheap enumeration, no content. */
export interface RevisionMeta {
  revid: number;
  parentid: number;
  /** ISO 8601, e.g. "2016-07-11T02:14:07Z". */
  timestamp: string;
  user?: string;
  comment?: string;
  /** Marked as a minor edit by its author. */
  minor: boolean;
}

/** The transport seam: replace in tests to serve recorded API responses. */
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
  /**
   * Cap on revision-list pages (500 revs each). A closed corpus is the whole
   * point, so the default is generous; callers get told when it bites.
   */
  maxPages?: number;
  /**
   * Optional process-wide cache. When present, the revision list and per-revid
   * wikitext are served from it — the dominant cost of a repeat trace. Left
   * undefined in tests so injected fixtures stay deterministic.
   */
  cache?: EngineCache;
}

export interface RevisionList {
  revisions: RevisionMeta[];
  /** True if `maxPages` cut the enumeration short — closure is then unproven. */
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

  /**
   * Enumerate every revision of an article, oldest first (index 0 is the
   * article's birth). Ascending index === chronological order, which is what
   * the binary search in blame.ts assumes.
   */
  async listRevisions(title: string): Promise<RevisionList> {
    const cached = this.cache?.getList(this.lang, title);
    if (cached) return cached;

    const revisions: RevisionMeta[] = [];
    let rvcontinue: string | undefined;
    let pages = 0;

    do {
      const params: Record<string, string> = {
        action: "query",
        prop: "revisions",
        titles: title,
        // Only ids + timestamp are consumed downstream (index order + dates).
        // Dropping user/comment/flags shrinks every page of the sequential
        // pagination — the enumeration is the trace's fixed up-front cost.
        rvprop: "ids|timestamp",
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
    this.cache?.setList(this.lang, title, result);
    return result;
  }

  /**
   * Fetch the raw wikitext of specific revisions. Batched (the API takes up to
   * 50 revids per request), returned as a revid→wikitext map. Missing/hidden
   * revisions are simply absent from the map.
   */
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

  /** Convenience: wikitext of a single revision, or null if unavailable. */
  async getRevisionContent(revid: number): Promise<string | null> {
    const cached = this.cache?.getContent(this.lang, revid);
    if (cached !== undefined) return cached; // null is a valid cached value

    const map = await this.getContent([revid]);
    const content = map.get(revid) ?? null;
    this.cache?.setContent(this.lang, revid, content);
    return content;
  }

  /**
   * Full-text search over article titles/content. Used to resolve a phrase to
   * candidate articles. Pass a raw query (e.g. a phrase) for ranked/fuzzy hits,
   * or `insource:"exact phrase"` for verbatim current-wikitext matches.
   */
  async search(query: string, limit = 8): Promise<SearchHit[]> {
    const params: Record<string, string> = {
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(limit),
      srprop: "snippet",
      srnamespace: "0", // articles only
    };
    const data = (await this.fetchJson(this.endpoint(params))) as ApiResponse;
    return (data.query?.search ?? []).map((h) => ({
      title: h.title,
      snippet: stripSnippet(h.snippet ?? ""),
    }));
  }
}

/** One search result: an article title and a plain-text context snippet. */
export interface SearchHit {
  title: string;
  snippet: string;
}

/** Strip the HTML the search API returns in snippets down to plain text. */
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

// --- Minimal shape of the formatversion=2 Action API JSON we consume. ---

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
