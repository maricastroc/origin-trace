/**
 * Scope resolution: given only a phrase, find which article(s) it could belong
 * to — WITHOUT pretending to be confident when it isn't.
 *
 * The rule, on purpose: the engine only pins a scope by itself when the phrase
 * appears verbatim in exactly one current article. Every other case — several
 * verbatim matches (a propagation signal), only fuzzy matches (wording may have
 * drifted), or nothing — returns the ambiguity for the human to resolve. It
 * never silently traces the wrong article.
 */
import { WikipediaClient, type FetchJson, type SearchHit } from "./wikipedia.ts";

export interface ArticleCandidate {
  title: string;
  snippet: string;
  /** The phrase appears verbatim in this article's current wikitext. */
  exactWikitextMatch: boolean;
  /** 1-based rank in the fuzzy relevance search, or null if absent from it. */
  fuzzyRank: number | null;
}

export interface Resolution {
  phrase: string;
  scope: "unambiguous" | "ambiguous" | "not-found";
  /** Set only when scope === "unambiguous". */
  resolved: string | null;
  candidates: ArticleCandidate[];
  /** An honest one-line account of why the scope is (or isn't) settled. */
  note: string;
}

export interface ResolveOptions {
  lang?: string;
  fetchJson?: FetchJson;
  /** How many candidates to surface. */
  limit?: number;
}

export async function resolveArticles(
  phrase: string,
  opts: ResolveOptions = {},
): Promise<Resolution> {
  const client = new WikipediaClient({
    lang: opts.lang,
    fetchJson: opts.fetchJson,
  });
  const limit = opts.limit ?? 6;

  // Quotes would break the insource:"..." wrapper — strip them for the probe.
  const clean = phrase.replace(/["“”]/g, " ").replace(/\s+/g, " ").trim();

  const [exact, fuzzy] = await Promise.all([
    client.search(`insource:"${clean}"`, 8),
    client.search(clean, 8),
  ]);

  const exactTitles = new Set(exact.map((h) => h.title));
  const fuzzyRankByTitle = new Map(fuzzy.map((h, i) => [h.title, i + 1]));

  const byTitle = new Map<string, ArticleCandidate>();
  for (const hit of [...exact, ...fuzzy] as SearchHit[]) {
    if (byTitle.has(hit.title)) continue;
    byTitle.set(hit.title, {
      title: hit.title,
      snippet: hit.snippet,
      exactWikitextMatch: exactTitles.has(hit.title),
      fuzzyRank: fuzzyRankByTitle.get(hit.title) ?? null,
    });
  }

  const candidates = [...byTitle.values()]
    .sort((a, b) => {
      if (a.exactWikitextMatch !== b.exactWikitextMatch) {
        return a.exactWikitextMatch ? -1 : 1;
      }
      return (a.fuzzyRank ?? 999) - (b.fuzzyRank ?? 999);
    })
    .slice(0, limit);

  const strong = candidates.filter((c) => c.exactWikitextMatch);

  if (candidates.length === 0) {
    return {
      phrase,
      scope: "not-found",
      resolved: null,
      candidates,
      note: "Not found verbatim or by relevance in any article. The phrase may be reworded, since removed, or not on Wikipedia — name the article to scope it.",
    };
  }

  if (strong.length === 1) {
    return {
      phrase,
      scope: "unambiguous",
      resolved: strong[0].title,
      candidates,
      note: `The phrase appears verbatim in exactly one article — “${strong[0].title}”. Scope resolved.`,
    };
  }

  if (strong.length >= 2) {
    return {
      phrase,
      scope: "ambiguous",
      resolved: null,
      candidates,
      note: `The phrase appears verbatim in ${strong.length} articles — itself a propagation signal. Pick the one to trace.`,
    };
  }

  return {
    phrase,
    scope: "ambiguous",
    resolved: null,
    candidates,
    note: "No article contains the phrase verbatim — the wording may have drifted. These are the closest by relevance; pick a scope or refine the phrase.",
  };
}
