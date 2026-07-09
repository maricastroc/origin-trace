import type { ClaimSource } from "@/types/ClaimSource";
import type { SourceType } from "@/types/SourceType";
import type { RevisionMeta } from "./wikipedia.ts";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[(?:[^\]]*\|)?([^\]|]*)\]\]/g, "$1")
    .replace(/[’‘`]/g, "'")
    .replace(/'{2,}/g, "")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsPhrase(content: string, phrase: string): boolean {
  return normalize(content).includes(normalize(phrase));
}

export type ContentReader = ((revid: number) => Promise<string | null>) & {
  prefetch?: (revids: number[]) => Promise<void>;
};

export interface IntroductionResult {
  index: number;
  revision: RevisionMeta;
  priorRevision: RevisionMeta | null;
  removedSince: boolean;
  assumptionViolated: boolean;
  contentFetches: number;
}

export async function findIntroduction(
  revisions: RevisionMeta[],
  phrase: string,
  getContent: ContentReader,
): Promise<IntroductionResult | null> {
  if (revisions.length === 0) return null;
  const norm = normalize(phrase);

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

  const prefetch = getContent.prefetch
    ? async (indices: number[]): Promise<void> => {
        const revids: number[] = [];
        for (const i of indices) {
          if (!seen.has(i)) revids.push(revisions[i].revid);
        }
        if (revids.length > 0) await getContent.prefetch!(revids);
      }
    : undefined;

  const n = revisions.length;
  
  const first = await earliestContaining(n, contains, prefetch);

  if (first < 0) return null;

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

async function earliestContaining(
  n: number,
  contains: (i: number) => Promise<boolean>,
  prefetch?: (indices: number[]) => Promise<void>,
): Promise<number> {
  let earliest = -1;

  let bound = n;

  while (bound > 0) {
    const hit = await sampleTrue(0, bound, contains, prefetch);
    if (hit < 0) break;
    const edge = await lowerBoundTrue(0, hit, contains, prefetch);
    earliest = edge;
    if (edge === 0) break;
    bound = edge;
  }
  return earliest;
}

const PREFETCH_DEPTH = 4;
const PREFETCH_MIN_SPAN = 4;

function bisectionProbes(lo: number, hi: number, depth: number): number[] {
  const probes: number[] = [];

  const walk = (l: number, h: number, d: number): void => {
    if (l >= h || d <= 0) return;
    const mid = (l + h) >> 1;
    probes.push(mid);
    walk(l, mid, d - 1);
    walk(mid + 1, h, d - 1);
  };

  walk(lo, hi, depth);

  return probes;
}

async function lowerBoundTrue(
  lo: number,
  hi: number,
  pred: (i: number) => Promise<boolean>,
  prefetch?: (indices: number[]) => Promise<void>,
): Promise<number> {
  while (lo < hi) {
    if (prefetch && hi - lo > PREFETCH_MIN_SPAN) {
      await prefetch(bisectionProbes(lo, hi, PREFETCH_DEPTH));
    }

    let steps = prefetch ? PREFETCH_DEPTH : Number.POSITIVE_INFINITY;

    while (lo < hi && steps-- > 0) {
      const mid = (lo + hi) >> 1;
      if (await pred(mid)) hi = mid;
      else lo = mid + 1;
    }
  }
  return lo;
}

async function sampleTrue(
  lo: number,
  hi: number,
  pred: (i: number) => Promise<boolean>,
  prefetch?: (indices: number[]) => Promise<void>,
): Promise<number> {
  const span = hi - lo;

  if (span <= 0) return -1;

  if (await pred(hi - 1)) return hi - 1;

  const probes = Math.min(
    span,
    Math.max(8, Math.ceil(Math.log2(span + 1)) * 2),
  );

  const indices: number[] = [];

  for (let k = 0; k < probes; k++) {
    indices.push(lo + Math.floor((k * span) / probes));
  }

  if (prefetch) await prefetch(indices);

  for (const i of indices) {
    if (await pred(i)) return i;
  }

  return -1;
}

export interface RefDetection {
  sourced: boolean;
  source: ClaimSource | null;
  refText: string | null;
  note: boolean;
}

export function detectRefNear(
  content: string,
  phrase: string,
  refDefs?: Map<string, string>,
): RefDetection {
  const nothing: RefDetection = {
    sourced: false,
    source: null,
    refText: null,
    note: false,
  };
  const paragraph = findParagraph(content, phrase);

  if (paragraph == null) return nothing;

  const defs = refDefs ?? indexRefDefinitions(content);

  const masked = maskedRanges(paragraph);

  const at = anchorInProse(paragraph, phrase, masked);

  const from = at >= 0 ? at : 0;
  
  const tail = scopeToSentence(paragraph, from);

  const markers = collectMarkers(tail, tail.length, defs);

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
    return {
      sourced: false,
      source: null,
      refText: explanatory.text,
      note: true,
    };
  }

  return nothing;
}

const SCOPE_ABBR = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "st",
  "mt",
  "no",
  "vs",
  "etc",
  "al",
  "e.g",
  "i.e",
  "cf",
  "ca",
  "fig",
  "jr",
  "sr",
  "inc",
  "ltd",
  "co",
  "corp",
  "u.s",
  "u.k",
  "a.d",
  "b.c",
]);

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
      continue;
    }

    if (ch === "." && isScopeAbbrev(masked, i)) {
      i = j;
      continue;
    }

    let end = j + 1;

    for (;;) {
      let p = end;
      while (
        p < paragraph.length &&
        /\s/.test(paragraph[p]) &&
        !inRanges(p, ranges)
      )
        p++;
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
  const word =
    text.slice(Math.max(0, i - 12), i).match(/([A-Za-z.]+)$/)?.[1] ?? "";

  if (!word) return false;

  if (SCOPE_ABBR.has(word.toLowerCase())) return true;

  return /^[A-Z]$/.test(word);
}

export interface Marker {
  index: number;
  kind: "citation" | "note";
  text: string;
  source: ClaimSource | null;
}

export function classifyInline(
  sentence: string,
  refDefs?: Map<string, string>,
): RefDetection {
  const markers = collectMarkers(sentence, sentence.length, refDefs);
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
    return {
      sourced: false,
      source: null,
      refText: explanatory.text,
      note: true,
    };
  }
  return { sourced: false, source: null, refText: null, note: false };
}

export function collectMarkers(
  text: string,
  maxGap: number,
  refDefs?: Map<string, string>,
): Marker[] {
  const markers: Marker[] = [];

  const refRe = /<ref\b([^>]*)\/>|<ref\b([^>]*)>([\s\S]*?)<\/ref>/gi;

  for (const m of text.matchAll(refRe)) {
    if (m.index === undefined || m.index > maxGap) continue;
    
    const attrs = `${m[1] ?? ""}${m[2] ?? ""}`;

    if (/\bgroup\s*=/.test(attrs)) {
      markers.push({ index: m.index, kind: "note", text: m[0], source: null });
    } else {
      let source = parseCitation(m[0]);
      if (source == null && refDefs) {
        const name = refName(attrs);
        const def = name ? refDefs.get(name) : undefined;
        if (def) source = parseCitation(def);
      }
      markers.push({ index: m.index, kind: "citation", text: m[0], source });
    }
  }

  for (const m of text.matchAll(/\{\{\s*(?:efn|refn|notetag)\b/gi)) {
    if (m.index === undefined || m.index > maxGap) continue;

    const block = balancedTemplate(text, m.index);

    if (!block) continue;

    const carriesSource =
      /<ref\b[^>]*>[\s\S]*?<\/ref>|\{\{\s*(?:cite|citation)\b/i.test(block);
    markers.push(
      carriesSource
        ? {
            index: m.index,
            kind: "citation",
            text: block,
            source: parseCitation(block),
          }
        : { index: m.index, kind: "note", text: block, source: null },
    );
  }

  for (const m of text.matchAll(SHORT_CITE_RE)) {
    if (m.index === undefined || m.index > maxGap) continue;

    const block = balancedTemplate(text, m.index);

    if (!block) continue;

    markers.push({
      index: m.index,
      kind: "citation",
      text: block,
      source: parseShortFootnote(block),
    });
  }

  return markers.sort((a, b) => a.index - b.index);
}

export function indexRefDefinitions(content: string): Map<string, string> {
  const defs = new Map<string, string>();

  const refRe = /<ref\b([^>]*)\/>|<ref\b([^>]*)>([\s\S]*?)<\/ref>/gi;

  for (const m of content.matchAll(refRe)) {
    if (m[3] === undefined) continue;

    const name = refName(m[2] ?? "");

    if (!name || defs.has(name) || !m[3].trim()) continue;
    defs.set(name, m[0]);
  }
  return defs;
}

function refName(attrs: string): string | null {
  const m = attrs.match(/\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/i);

  const raw = m ? (m[1] ?? m[2] ?? m[3]) : null;

  return raw ? raw.trim().toLowerCase() : null;
}

const SHORT_CITE_RE =
  /\{\{\s*(?:sfnp|sfnm|sfn|harvnb|harvtxt|harvcolnb|harvcoltxt|harvcol|harvp|harv)\b/gi;

export function parseShortFootnote(block: string): ClaimSource {

  const inner = block.replace(/^\{\{\s*/, "").replace(/\}\}\s*$/, "");

  const parts = inner.split("|").map((p) => p.trim());

  parts.shift();

  let year: number | undefined;
  const authors: string[] = [];

  for (const part of parts) {
    if (!part || part.includes("=")) continue;

    const y = part.match(/^(1[89]\d{2}|20\d{2})[a-z]?$/);

    if (y && year === undefined) year = Number(y[1]);

    else authors.push(part);
  }

  const label =
    authors.length === 0
      ? "shortened footnote"
      : authors.length <= 2
        ? authors.join(" & ")
        : `${authors[0]} et al.`;

  const source: ClaimSource = { label, type: "other" };
  if (year) source.year = year;
  return source;
}

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

function findParagraph(content: string, phrase: string): string | null {
  const norm = normalize(phrase);
  for (const block of content.split(/\n{2,}|\n(?=[*#:|=])/)) {
    if (normalize(block).includes(norm)) return block;
  }
  return normalize(content).includes(norm) ? content : null;
}

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

export function parseCitation(refText: string): ClaimSource | null {
  const tpl = refText.match(/\{\{\s*(cite|citation)\s+([\s\S]*?)\}\}/i);
  if (!tpl) {
    const url = refText.match(/https?:\/\/[^\s|}\]<]+/)?.[0];

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
