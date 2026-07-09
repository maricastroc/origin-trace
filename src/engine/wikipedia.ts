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

// How many timestamp windows a long history is split into, how many fetch at once,
// and the boundary bias. Edit density rises toward the present, so windows are made
// narrower (in time) near the recent end — `WINDOW_BIAS > 1` — to keep their
// revision counts, and therefore their page depths, roughly even.
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

  /** Reconstruct the full ordered revision list. The first page doubles as a size
   *  probe: a short history returns in a single round-trip with no window overhead,
   *  while a long one hands its remaining timespan to concurrent windowed fetches —
   *  the serial `rvcontinue` chain (≈25 sequential requests for a 12k-rev article)
   *  collapses to a few. Windows use inclusive [start,end] bounds and may overlap at
   *  a seam; {@link mergeRevisions} dedupes by revid and re-sorts by (timestamp,
   *  revid), so the output is identical to serial pagination — nothing lost or
   *  duplicated at a boundary, whatever the edit-density distribution. */
  private async fetchRevisionList(title: string): Promise<RevisionList> {
    // The first page doubles as the size probe: if the whole history fit (no
    // continuation), we're done in a single request and never pay for windowing.
    const firstPage = await this.collectRange(title, {}, 1);
    if (!firstPage.continued) {
      return { revisions: firstPage.revisions, truncated: false };
    }

    // A long history: pin the upper bound, then window the remaining span.
    const latest = await this.latestTimestamp(title);
    if (latest === null) {
      return { revisions: firstPage.revisions, truncated: firstPage.continued };
    }

    const startTs = firstPage.revisions[firstPage.revisions.length - 1]?.timestamp ?? "";
    const windows = planTimeWindows(startTs, latest, WINDOW_COUNT);
    if (windows.length === 0) {
      // Degenerate span (every remaining revision shares an instant): finish serially.
      const rest = await this.collectRange(title, { start: startTs }, this.maxPages);
      return mergeRevisions([firstPage.revisions, rest.revisions], rest.continued);
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

  /** Page through revisions oldest-first within an optional inclusive [start,end]
   *  timestamp window. Stops after `maxPages`; `continued` reports whether the API
   *  still had more within the window. */
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
        rvprop: "ids|timestamp|comment",
        rvlimit: "max",
        rvdir: "newer",
      };
      // rvdir=newer enumerates oldest→newest, so rvstart is the older bound and
      // rvend the newer one (both inclusive). Resent every page so rvcontinue stays
      // scoped to this window.
      if (window.start) params.rvstart = window.start;
      if (window.end) params.rvend = window.end;
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

/** Partition `[startTs, endTs]` into contiguous inclusive timestamp windows, biased
 *  so slices near the recent (denser) end are narrower. Adjacent windows deliberately
 *  share their boundary instant — {@link mergeRevisions} dedupes the overlap — which
 *  guarantees full coverage with zero gaps. Returns `[]` for an empty/degenerate span
 *  so the caller can fall back to a serial finish. Exported for equivalence tests. */
export function planTimeWindows(
  startTs: string,
  endTs: string,
  k: number,
): Array<{ start: string; end: string }> {
  const startMs = Date.parse(startTs);
  const endMs = Date.parse(endTs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const windows: Array<{ start: string; end: string }> = [];
  let prev = startMs;
  for (let i = 1; i <= k; i++) {
    const frac = 1 - Math.pow(1 - i / k, WINDOW_BIAS); // 0→1, gaps shrink toward endMs
    const boundary = i === k ? endMs : Math.round(startMs + (endMs - startMs) * frac);
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
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.revid - b.revid,
  );
  return { revisions, truncated };
}

/** Second-precision ISO 8601, the format MediaWiki's rvstart/rvend accept (the
 *  millisecond suffix `toISOString` emits is rejected). */
function msToIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Run `fn` over `items` with at most `limit` in flight, preserving input order in
 *  the result. A small worker pool — no dependency, no unbounded fan-out at the API. */
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

/** Turn a raw search snippet into readable prose. `insource:"…"` matches land
 *  inside wikitext, so the API returns markup fragments — escaped `<ref>` tags,
 *  citation templates, links, headings, and template halves sheared off at the
 *  snippet's edges. We decode entities, then peel that markup tolerantly: balanced
 *  templates are removed outright, and the orphaned `…}}` / `{{…` at the fragment
 *  boundaries (a template opened or closed outside the excerpt) are trimmed rather
 *  than left dangling. */
function stripSnippet(html: string): string {
  let s = html
    // Drop the real HTML the search API adds (the <span class="searchmatch"> hits).
    .replace(/<[^>]+>/g, " ")
    // Decode entities so the wikitext's own escaped `<`, `>`, quotes surface; `&amp;`
    // last so we never double-decode a `&amp;lt;`-style sequence.
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  // References (and any now-unescaped stray tags) carry no readable prose.
  s = s
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]*>/g, "");

  // Remove balanced templates, repeating to peel nesting, then trim the orphan
  // template halves left at the fragment's edges.
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  } while (s !== prev);
  s = s.replace(/^[^{}]*\}\}/, "").replace(/\{\{[^{}]*$/, "");

  return s
    // Wiki links → their visible label; external links → their anchor text.
    .replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/\[\[|\]\]/g, "") // orphan link brackets sheared at the edges
    .replace(/={2,}\s*([^=]*?)\s*={2,}/g, "$1") // ==Heading== → Heading
    .replace(/'{2,}/g, "") // bold/italic markers
    .replace(/(^|\s)[*#]+\s*/g, "$1") // list bullets, even once collapsed inline
    .replace(/\{\||\|\}|\|[-+]/g, " ") // table scaffolding
    .replace(/\s*\|\s*/g, " ") // leftover template/gallery pipes
    .replace(/\s+([.,;:)])/g, "$1")
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
