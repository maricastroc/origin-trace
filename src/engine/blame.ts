/**
 * The blame primitive: given an article's revision list and a claim phrase,
 * locate the revision where the phrase first appeared (WikiBlame-style binary
 * search) and read the citation, if any, attached to it.
 *
 * Pure over the data — the only I/O is the injected `getContent`, so this is
 * unit-testable without touching the network.
 */
import type { ClaimSource } from "@/types/ClaimSource";
import type { SourceType } from "@/types/SourceType";
import type { RevisionMeta } from "./wikipedia.ts";

/**
 * Fold a phrase or a chunk of wikitext down to a comparable core: drop <ref>
 * bodies (so a claim still matches when a citation is bolted onto it), unwrap
 * links, and reduce markup/punctuation to single spaces. Substring matching
 * then survives most re-linking and re-formatting.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/<ref[^>]*\/>/g, " ") // self-closing <ref name=".." />
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ") // <ref>…</ref> bodies
    .replace(/<[^>]+>/g, " ") // any other tag
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1") // [[a|b]] → b, [[a]] → a
    .replace(/[’‘`]/g, "'")
    .replace(/'{2,}/g, "") // ''italic'' / '''bold''' markup — drop, keep contractions
    .replace(/[^a-z0-9']+/g, " ") // punctuation & leftover markup → space
    .replace(/\s+/g, " ")
    .trim();
}

export function containsPhrase(content: string, phrase: string): boolean {
  return normalize(content).includes(normalize(phrase));
}

/** A revid → wikitext reader; the engine wraps the API client + a cache here. */
export type ContentReader = (revid: number) => Promise<string | null>;

export interface IntroductionResult {
  /** Index into the revision list of the first revision containing the phrase. */
  index: number;
  revision: RevisionMeta;
  /** The revision just before introduction (the "absent" state), or null if born-with. */
  priorRevision: RevisionMeta | null;
  /** True if the phrase is gone from the newest revision (removed since). */
  removedSince: boolean;
  /** The boundary check failed — presence isn't cleanly monotonic; treat with care. */
  assumptionViolated: boolean;
  /** How many revisions we actually had to read (the binary-search dividend). */
  contentFetches: number;
}

/**
 * Find the earliest revision containing the phrase.
 *
 * Real histories are not monotonic: a phrase can be introduced, reworded away,
 * then reappear — several disjoint "present" bands with gaps between them. A
 * plain lower-bound search would return the left edge of whichever band the
 * probes happened to fall into (usually the current one), not the true origin.
 *
 * So we find the left edge of a known band, then re-search the prefix below it
 * for any earlier occurrence, and repeat. Each round costs O(log n) reads and
 * strictly lowers the bound, converging on the earliest band — where, by
 * definition, everything below is absent and the boundary is exact.
 */
export async function findIntroduction(
  revisions: RevisionMeta[],
  phrase: string,
  getContent: ContentReader,
): Promise<IntroductionResult | null> {
  if (revisions.length === 0) return null;
  const norm = normalize(phrase);

  // Memoize the boolean predicate; the trace's content cache already dedupes
  // network reads, this dedupes the normalize() too and counts real fetches.
  const seen = new Map<number, boolean>();
  let fetches = 0;
  const contains = async (i: number): Promise<boolean> => {
    if (seen.has(i)) return seen.get(i)!;
    const content = await getContent(revisions[i].revid);
    fetches += 1;
    const hit = content != null && normalize(content).includes(norm);
    seen.set(i, hit);
    return hit;
  };

  const n = revisions.length;
  const first = await earliestContaining(n, contains);
  if (first < 0) return null; // honest abstention: not found where we looked

  const presentNow = await contains(n - 1);
  const priorContains = first > 0 ? await contains(first - 1) : false;
  const foundContains = await contains(first);

  return {
    index: first,
    revision: revisions[first],
    priorRevision: first > 0 ? revisions[first - 1] : null,
    removedSince: !presentNow,
    assumptionViolated: !foundContains || priorContains,
    contentFetches: fetches,
  };
}

/** Index of the earliest revision satisfying `contains`, robust to gaps, or -1. */
async function earliestContaining(
  n: number,
  contains: (i: number) => Promise<boolean>,
): Promise<number> {
  let earliest = -1;
  let bound = n; // search the prefix [0, bound) for a still-earlier band
  while (bound > 0) {
    const hit = await sampleTrue(0, bound, contains);
    if (hit < 0) break;
    const edge = await lowerBoundTrue(0, hit, contains);
    earliest = edge;
    if (edge === 0) break;
    bound = edge;
  }
  return earliest;
}

/** Smallest i in [lo, hi] with pred(i), assuming pred is false…false true…true. */
async function lowerBoundTrue(
  lo: number,
  hi: number,
  pred: (i: number) => Promise<boolean>,
): Promise<number> {
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (await pred(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Probe a spread of revisions in [lo, hi) for any hit; return its index or -1. */
async function sampleTrue(
  lo: number,
  hi: number,
  pred: (i: number) => Promise<boolean>,
): Promise<number> {
  const span = hi - lo;
  if (span <= 0) return -1;
  // The newest in-range revision is the most likely survivor — check it first.
  if (await pred(hi - 1)) return hi - 1;
  const probes = Math.min(span, Math.max(8, Math.ceil(Math.log2(span + 1)) * 2));
  for (let k = 0; k < probes; k++) {
    const i = lo + Math.floor((k * span) / probes);
    if (await pred(i)) return i;
  }
  return -1;
}

// --- Citation extraction ---------------------------------------------------

/**
 * Does a <ref> sit on the claim within its paragraph, and what does it cite?
 *
 * Heuristic but honest: we anchor on the phrase (its whole normalized form, or
 * its most distinctive word), then look ahead a short window for a <ref>. Good
 * for the common "claim.<ref>{{cite …}}</ref>" shape; deliberately modest.
 */
export interface RefDetection {
  sourced: boolean;
  source: ClaimSource | null;
  /** The raw citation/note block we found attached, if any. */
  refText: string | null;
  /**
   * An explanatory footnote ({{efn}}/{{refn}} or a grouped <ref group=…>) sits
   * on the claim, but it cites no source. This is the "[α]" marker that reads
   * like a reference yet backs nothing — reported so the UI can say exactly that
   * instead of a bare "unsourced".
   */
  note: boolean;
}

export function detectRefNear(content: string, phrase: string): RefDetection {
  const nothing: RefDetection = {
    sourced: false,
    source: null,
    refText: null,
    note: false,
  };
  const paragraph = findParagraph(content, phrase);
  if (paragraph == null) return nothing;

  // Anchor on the phrase where it appears as *prose*, not where it happens to
  // occur inside a citation's own title/URL — otherwise we'd start the search
  // past the opening <ref> and miss the citation that actually backs the claim.
  const masked = maskedRanges(paragraph);
  const at = anchorInProse(paragraph, phrase, masked);
  const from = at >= 0 ? at : 0;
  // Bound the search to the claim's OWN sentence (citations trail the terminal
  // period, so they're included). A flat forward window would spill into the
  // next sentence and credit this claim with the neighbour's citation — which
  // also made whole-article audits disagree with the per-sentence drill-down.
  const tail = scopeToSentence(paragraph, from);

  // A real citation anywhere in the window wins — the claim is backed. Only when
  // there is none do we fall back to reporting an explanatory note, which looks
  // like a reference but sources nothing (the classic {{efn}} "[α]" marker).
  const markers = collectMarkers(tail, tail.length);
  const citation = markers.find((m) => m.kind === "citation");
  if (citation) {
    return {
      sourced: true,
      source: citation.source,
      refText: citation.text,
      note: false,
    };
  }
  const explanatory = markers.find((m) => m.kind === "note");
  if (explanatory) {
    return { sourced: false, source: null, refText: explanatory.text, note: true };
  }
  return nothing;
}

/**
 * Abbreviations that end in a period without ending the sentence — so the scope
 * doesn't cut short (and lose the sentence's real trailing citation) at "U.S."
 */
const SCOPE_ABBR = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "mt", "no", "vs", "etc", "al",
  "e.g", "i.e", "cf", "ca", "fig", "jr", "sr", "inc", "ltd", "co", "corp",
  "u.s", "u.k", "a.d", "b.c",
]);

/**
 * The slice of `paragraph` from `from` to the end of the sentence the anchor is
 * in — INCLUDING any <ref>/citation templates that trail the terminal period
 * (`claim.<ref>…`). Guards against decimals and abbreviations so it doesn't end
 * the sentence early and miss the citation that actually backs the claim.
 */
function scopeToSentence(paragraph: string, from: number): string {
  const ranges = maskedRanges(paragraph);
  const chars = paragraph.split("");
  for (const [a, b] of ranges) {
    for (let i = a; i < b && i < chars.length; i++) {
      if (chars[i] !== "\n") chars[i] = " ";
    }
  }
  const masked = chars.join("");

  for (let i = from; i < masked.length; i++) {
    const ch = masked[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    let j = i;
    while (j + 1 < masked.length && ".!?".includes(masked[j + 1])) j++;

    if (ch === "." && /\d/.test(masked[i + 1] ?? "")) {
      i = j;
      continue; // decimal, e.g. 3.5
    }
    if (ch === "." && isScopeAbbrev(masked, i)) {
      i = j;
      continue;
    }

    // Pull trailing citation refs into this sentence before deciding the break.
    let end = j + 1;
    for (;;) {
      let p = end;
      while (p < paragraph.length && /\s/.test(paragraph[p]) && !inRanges(p, ranges)) p++;
      const span = ranges.find(([a]) => a === p);
      if (!span) break;
      end = span[1];
    }
    const after = masked.slice(end);
    const gap = after.match(/^\s+/)?.[0] ?? "";
    const next = after[gap.length];
    if (next === undefined || /[A-Z0-9"'“(\[]/.test(next)) {
      return paragraph.slice(from, end);
    }
    i = j;
  }
  return paragraph.slice(from);
}

function isScopeAbbrev(text: string, i: number): boolean {
  const word = text.slice(Math.max(0, i - 12), i).match(/([A-Za-z.]+)$/)?.[1] ?? "";
  if (!word) return false;
  if (SCOPE_ABBR.has(word.toLowerCase())) return true;
  return /^[A-Z]$/.test(word); // a single-letter initial, e.g. "J."
}

/**
 * Markers attached to a claim within `maxGap` chars of the anchor, classified.
 *
 * A <ref> with no group, and inline citation templates, are *citations*. A
 * grouped <ref group=…> tag and {{efn}}/{{refn}} note templates are *explanatory
 * notes* — unless such a note itself embeds a citation, in which case it counts
 * as backing the claim after all.
 */
export interface Marker {
  index: number;
  kind: "citation" | "note";
  text: string;
  source: ClaimSource | null;
}

/**
 * Classify an isolated span of prose (a single sentence) by the citation it
 * carries, if any. The article-audit reuses this so "what counts as a citation
 * vs. an explanatory note" lives in exactly one place — the same rules the
 * per-claim trace applies. Returns the first real citation in the span, else an
 * explanatory note, else unsourced.
 */
export function classifyInline(sentence: string): RefDetection {
  const markers = collectMarkers(sentence, sentence.length);
  const citation = markers.find((m) => m.kind === "citation");
  if (citation) {
    return { sourced: true, source: citation.source, refText: citation.text, note: false };
  }
  const explanatory = markers.find((m) => m.kind === "note");
  if (explanatory) {
    return { sourced: false, source: null, refText: explanatory.text, note: true };
  }
  return { sourced: false, source: null, refText: null, note: false };
}

export function collectMarkers(text: string, maxGap: number): Marker[] {
  const markers: Marker[] = [];

  // <ref …/> reuse and <ref …>…</ref> blocks. `group=` ⇒ a footnote group
  // (notes), otherwise the article's real references.
  const refRe = /<ref\b([^>]*)\/>|<ref\b([^>]*)>([\s\S]*?)<\/ref>/gi;
  for (const m of text.matchAll(refRe)) {
    if (m.index === undefined || m.index > maxGap) continue;
    const attrs = `${m[1] ?? ""}${m[2] ?? ""}`;
    if (/\bgroup\s*=/.test(attrs)) {
      markers.push({ index: m.index, kind: "note", text: m[0], source: null });
    } else {
      markers.push({
        index: m.index,
        kind: "citation",
        text: m[0],
        source: parseCitation(m[0]),
      });
    }
  }

  // {{efn|…}} / {{refn|…}} explanatory notes — brace-balanced so nested {{cite}}
  // templates don't truncate the block.
  for (const m of text.matchAll(/\{\{\s*(?:efn|refn|notetag)\b/gi)) {
    if (m.index === undefined || m.index > maxGap) continue;
    const block = balancedTemplate(text, m.index);
    if (!block) continue;
    const carriesSource =
      /<ref\b[^>]*>[\s\S]*?<\/ref>|\{\{\s*(?:cite|citation)\b/i.test(block);
    markers.push(
      carriesSource
        ? { index: m.index, kind: "citation", text: block, source: parseCitation(block) }
        : { index: m.index, kind: "note", text: block, source: null },
    );
  }

  return markers.sort((a, b) => a.index - b.index);
}

/** From a "{{" at `start`, return the full brace-balanced template text, or null. */
function balancedTemplate(text: string, start: number): string | null {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Character spans occupied by <ref>…</ref> blocks and {{templates}}. */
export function maskedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const re of [
    /<ref[^>]*>[\s\S]*?<\/ref>/g,
    /<ref[^>]*\/>/g,
    /\{\{[\s\S]*?\}\}/g,
  ]) {
    for (const m of text.matchAll(re)) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  return ranges;
}

function inRanges(i: number, ranges: [number, number][]): boolean {
  return ranges.some(([a, b]) => i >= a && i < b);
}

/** First prose occurrence of the phrase (or its longest word) outside masks. */
function anchorInProse(
  text: string,
  phrase: string,
  masked: [number, number][],
): number {
  const hay = text.toLowerCase();
  const full = phrase.toLowerCase().replace(/\s+/g, " ").trim();
  const longest = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];

  for (const needle of [full, longest].filter(Boolean) as string[]) {
    let i = hay.indexOf(needle);
    while (i >= 0) {
      if (!inRanges(i, masked)) return i;
      i = hay.indexOf(needle, i + 1);
    }
  }
  return -1;
}

/** The paragraph (newline-delimited block) whose normalized text holds the phrase. */
function findParagraph(content: string, phrase: string): string | null {
  const norm = normalize(phrase);
  for (const block of content.split(/\n{2,}|\n(?=[*#:|=])/)) {
    if (normalize(block).includes(norm)) return block;
  }
  return normalize(content).includes(norm) ? content : null;
}

/**
 * Index of the phrase within `text`: the full phrase if present verbatim,
 * otherwise its longest (most distinctive) word — never a short common word
 * like "animal" that scatters across the article.
 */
export function anchorIndex(text: string, phrase: string): number {
  const hay = text.toLowerCase();
  const full = phrase.toLowerCase().replace(/\s+/g, " ").trim();
  const direct = hay.indexOf(full);
  if (direct >= 0) return direct;

  const longest = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  return longest ? hay.indexOf(longest) : -1;
}

/** Map a {{cite …}} template (or bare ref) to a ClaimSource. Best-effort. */
export function parseCitation(refText: string): ClaimSource | null {
  const tpl = refText.match(/\{\{\s*(cite|citation)\s+([\s\S]*?)\}\}/i);
  if (!tpl) {
    // A bare <ref> with a URL or free text — record it without over-claiming.
    const url = refText.match(/https?:\/\/\S+/)?.[0];
    return url ? { label: hostname(url), type: "other", url } : null;
  }

  const fields = parseTemplateFields(tpl[2]);
  const citeType = fields["__citetype"] ?? "";
  const label =
    fields["work"] ||
    fields["newspaper"] ||
    fields["journal"] ||
    fields["magazine"] ||
    fields["website"] ||
    fields["publisher"] ||
    fields["title"] ||
    fields["last"] ||
    fields["author"] ||
    "untitled source";

  const year = extractYear(fields["date"] ?? fields["year"] ?? "");
  const source: ClaimSource = { label, type: sourceTypeFor(citeType, fields) };
  if (year) source.year = year;
  const url = fields["url"];
  if (url) source.url = url;
  return source;
}

function parseTemplateFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const head = body.split("|")[0]?.trim().toLowerCase() ?? "";
  fields["__citetype"] = head.replace(/^cite\s+/, "");
  for (const part of body.split("|").slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

function sourceTypeFor(
  citeType: string,
  fields: Record<string, string>,
): SourceType {
  if (citeType.includes("journal")) return "peer-reviewed";
  if (citeType.includes("news")) return "newspaper";
  if (fields["newspaper"]) return "newspaper";
  if (fields["journal"]) return "peer-reviewed";
  return "other";
}

function extractYear(s: string): number | undefined {
  const m = s.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
