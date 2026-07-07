/**
 * Thin typed client for the MediaWiki Action API.
 *
 * The engine's only door to the outside world. Everything downstream
 * (blame, trace) is pure and operates on the data this returns, so it can be
 * unit-tested against recorded fixtures by swapping the `fetchJson` transport.
 */

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

  constructor(opts: WikipediaClientOptions = {}) {
    this.lang = opts.lang ?? "en";
    this.fetchJson = opts.fetchJson ?? defaultFetchJson;
    this.maxPages = opts.maxPages ?? 200;
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
    const revisions: RevisionMeta[] = [];
    let rvcontinue: string | undefined;
    let pages = 0;

    do {
      const params: Record<string, string> = {
        action: "query",
        prop: "revisions",
        titles: title,
        rvprop: "ids|timestamp|user|comment|flags",
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

    return { revisions, truncated: Boolean(rvcontinue) };
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
    const map = await this.getContent([revid]);
    return map.get(revid) ?? null;
  }
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

interface ApiResponse {
  query?: { pages?: ApiPage[] };
  continue?: { rvcontinue?: string };
}
