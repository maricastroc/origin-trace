/**
 * Article audit: the cheap, structural "sourced map" of a whole article.
 *
 * One fetch of the current wikitext, then pure work — no history walk. The claim
 * boundary is taken from Wikipedia's own structure (a sentence, and whether a
 * <ref> sits on it), NOT from NLP. Segmentation is deliberately conservative and
 * honest about being heuristic; the per-sentence citation call reuses the exact
 * same rules as the per-claim trace (blame.ts), so "what counts as a citation"
 * lives in one place.
 */
import type {
  ArticleAudit,
  AuditClaim,
  AuditSection,
  AuditTally,
  SentenceStatus,
} from "@/types/ArticleAudit";
import { classifyInline, maskedRanges } from "./blame.ts";
import { WikipediaClient, type FetchJson } from "./wikipedia.ts";
import type { EngineCache } from "./cache.ts";

export interface AuditInput {
  article: string;
  lang?: string;
  fetchJson?: FetchJson;
  cache?: EngineCache;
}

export class ArticleNotFoundError extends Error {
  constructor(article: string, lang: string) {
    super(`Article has no readable current revision: "${article}" (${lang})`);
    this.name = "ArticleNotFoundError";
  }
}

export async function auditArticle(input: AuditInput): Promise<ArticleAudit> {
  const lang = input.lang ?? "en";
  const client = new WikipediaClient({
    lang,
    fetchJson: input.fetchJson,
    cache: input.cache,
  });

  // The client throws a generic "Article not found" for a missing page and
  // returns null for a page with no readable content; both are the same 404 here.
  const current = await client.getCurrentContent(input.article).catch((err) => {
    if (err instanceof Error && /not found/i.test(err.message)) {
      throw new ArticleNotFoundError(input.article, lang);
    }
    throw err;
  });
  if (!current) throw new ArticleNotFoundError(input.article, lang);

  const sections = segmentArticle(current.content);
  const summary = tally(sections);

  return {
    article: {
      title: input.article,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
        input.article.replace(/ /g, "_"),
      )}`,
      lang,
      revId: current.revid,
    },
    sections,
    summary,
    meta: {
      generatedBy: "wikiblame-audit",
      fetchedAt: new Date().toISOString(),
      notes:
        "Sentence boundaries are inferred structurally (heuristic). “Unsourced” means no inline citation sits on the sentence — descriptive, not a verdict: some sentences legitimately need none, and lead-section claims are conventionally cited in the body.",
    },
  };
}

// --- Segmentation ----------------------------------------------------------

/** Level-2 sections that are apparatus, not prose — skipped wholesale. */
const APPARATUS =
  /^(references?|notes?|footnotes?|citations?|sources?|bibliography|further reading|external links?|see also|works cited|explanatory notes?)$/i;

interface RawSection {
  heading: string;
  level: number;
  isLead: boolean;
  body: string;
}

/**
 * Split wikitext into sections, classify each sentence. The lead is the text
 * before the first heading; apparatus sections are dropped.
 */
export function segmentArticle(wikitext: string): AuditSection[] {
  const clean = wikitext
    .replace(/<!--[\s\S]*?-->/g, "") // HTML comments
    .replace(/<!--[\s\S]*$/g, ""); // an unterminated trailing comment

  const raw = splitSections(clean);
  const out: AuditSection[] = [];
  let counter = 0;

  for (const sec of raw) {
    if (!sec.isLead && APPARATUS.test(sec.heading.trim())) continue;
    const claims: AuditClaim[] = [];
    for (const sentence of sentences(sec.body)) {
      const display = cleanProse(sentence);
      if (!isAuditable(display)) continue;
      const det = classifyInline(sentence);
      const status: SentenceStatus = det.sourced
        ? "sourced"
        : det.note
          ? "note-only"
          : "unsourced";
      claims.push({
        id: `c${counter++}`,
        text: display,
        status,
        ...(status === "sourced" ? { source: det.source } : {}),
      });
    }
    if (claims.length > 0) {
      out.push({
        heading: sec.heading,
        level: sec.level,
        isLead: sec.isLead,
        claims,
      });
    }
  }

  return out;
}

/** Break wikitext at `== Heading ==` lines; the pre-heading text is the lead. */
function splitSections(text: string): RawSection[] {
  const headingRe = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;
  const sections: RawSection[] = [];
  let lastIndex = 0;
  let pending: { heading: string; level: number } | null = null;

  const push = (body: string, meta: { heading: string; level: number } | null) => {
    sections.push({
      heading: meta?.heading ?? "",
      level: meta?.level ?? 0,
      isLead: meta === null,
      body,
    });
  };

  for (const m of text.matchAll(headingRe)) {
    const body = text.slice(lastIndex, m.index);
    push(body, pending);
    pending = { heading: m[2], level: m[1].length };
    lastIndex = m.index! + m[0].length;
  }
  push(text.slice(lastIndex), pending);
  return sections;
}

/**
 * Split a section body into sentences over its *prose* lines only. Block-level
 * non-prose (tables, templates, lists, file/image lines, headings-in-body) is
 * dropped first; then <ref>/{{template}} spans are masked so their internal
 * periods don't create false boundaries, and we split on sentence terminators
 * with an abbreviation guard. Returns raw sentence slices (refs intact) for
 * classification.
 */
export function sentences(body: string): string[] {
  const prose = proseLines(body);
  const out: string[] = [];
  for (const para of prose) {
    for (const s of splitSentences(para)) {
      const trimmed = s.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

/** Keep only paragraph lines that read as prose; strip tables and templates. */
function proseLines(body: string): string[] {
  const withoutTables = stripTables(body);
  const paras: string[] = [];
  for (const block of withoutTables.split(/\n{2,}/)) {
    const kept: string[] = [];
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      // Lists, definitions, table rows, file/image embeds, hatnotes, headings.
      if (/^[*#:;!|]/.test(t)) continue;
      if (/^\{\{/.test(t) && /\}\}$/.test(t)) continue; // a whole-line template
      if (/^\[\[\s*(File|Image|Category)\s*:/i.test(t)) continue;
      if (/^(={2,6})\s*.+\1$/.test(t)) continue;
      if (/^<\/?(gallery|table|blockquote|div|ref|references)/i.test(t)) continue;
      kept.push(line);
    }
    if (kept.length) paras.push(kept.join(" "));
  }
  return paras;
}

/** Remove `{| … |}` wikitable blocks (they hold no auditable prose claims). */
function stripTables(text: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === "{|") {
      depth++;
      i++;
      continue;
    }
    if (two === "|}" && depth > 0) {
      depth--;
      i++;
      continue;
    }
    if (depth === 0) out += text[i];
  }
  return out;
}

/** Abbreviations that end in a period but not a sentence. */
const ABBR = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "mt", "no", "vs", "etc", "al",
  "e.g", "i.e", "cf", "c", "ca", "fig", "gen", "sen", "rep", "gov", "col",
  "jr", "sr", "inc", "ltd", "co", "corp", "u.s", "u.k", "a.d", "b.c",
]);

/**
 * Split one prose paragraph into sentences, robust to markup and abbreviations.
 *
 * Boundaries are found on a masked copy (periods inside <ref>/{{…}} don't count).
 * Crucially, a citation in wikitext follows the terminal period — `claim.<ref>…`
 * — so once a boundary is found we *extend* the sentence to swallow any trailing
 * ref/template spans, keeping the citation with the sentence it backs instead of
 * orphaning it onto the next one.
 */
function splitSentences(para: string): string[] {
  const masked = maskString(para);
  const ranges = maskedRanges(para);
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    // Consume a run of terminators (e.g. "?!", "...").
    let j = i;
    while (j + 1 < masked.length && ".!?".includes(masked[j + 1])) j++;

    // Decimals (3.5) and abbreviations (U.S., e.g.) are not boundaries.
    if (ch === "." && /\d/.test(masked[i + 1] ?? "")) {
      i = j;
      continue;
    }
    if (ch === "." && isAbbrevBefore(masked, i)) {
      i = j;
      continue;
    }

    // Pull any citation/template spans that sit right after the period into this
    // sentence, then require whitespace + an opener (or end) to call it a break.
    const end = swallowTrailing(j + 1, para, ranges);
    const after = masked.slice(end);
    const gap = after.match(/^\s+/)?.[0] ?? "";
    const next = after[gap.length];
    const opensNext = next === undefined || /[A-Z0-9"'“(\[]/.test(next);
    if (next !== undefined && gap.length === 0) {
      i = j;
      continue;
    }

    if (opensNext) {
      out.push(para.slice(start, end));
      start = end + gap.length;
      i = end + gap.length - 1;
    } else {
      i = j;
    }
  }
  if (start < para.length) out.push(para.slice(start));
  return out;
}

/**
 * From index `from`, consume ref/template spans that sit right after the period
 * (`claim.<ref>…`, possibly across a space), returning the new sentence end.
 * Works on the original text + ranges so real whitespace is distinguishable from
 * a masked span (both look like spaces in the masked copy).
 */
function swallowTrailing(
  from: number,
  para: string,
  ranges: [number, number][],
): number {
  let end = from;
  for (;;) {
    let p = end;
    // Skip real whitespace that is not itself inside a masked span.
    while (p < para.length && /\s/.test(para[p]) && !inRange(p, ranges)) p++;
    const span = ranges.find(([a]) => a === p);
    if (!span) break;
    end = span[1];
  }
  return end;
}

function inRange(i: number, ranges: [number, number][]): boolean {
  return ranges.some(([a, b]) => i >= a && i < b);
}

/** Is the word ending at index `i` (a period) a known abbreviation? */
function isAbbrevBefore(text: string, i: number): boolean {
  const before = text.slice(Math.max(0, i - 12), i);
  const word = before.match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase() ?? "";
  if (!word) return false;
  if (ABBR.has(word)) return true;
  // A single capital letter + period is an initial (e.g. "J. R. R.").
  const rawWord = text.slice(Math.max(0, i - 12), i).match(/([A-Za-z.]+)$/)?.[1] ?? "";
  return /^[A-Z]$/.test(rawWord);
}

/** Replace <ref>/{{template}} spans with spaces of equal length (indices intact). */
function maskString(text: string): string {
  const ranges = maskedRanges(text);
  if (ranges.length === 0) return text;
  const chars = text.split("");
  for (const [a, b] of ranges) {
    for (let i = a; i < b && i < chars.length; i++) {
      if (chars[i] !== "\n") chars[i] = " ";
    }
  }
  return chars.join("");
}

// --- Display cleaning & filtering ------------------------------------------

/** Turn a raw wikitext sentence into readable prose (refs and markup gone). */
function cleanProse(sentence: string): string {
  return sentence
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, unwrapTemplate) // keep values from {{convert}} etc.
    .replace(/\{\{[^{}]*\}\}/g, "") // any leftover (nested) template
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\([^A-Za-z0-9]*\)/g, "") // parens emptied to just punctuation
    .replace(/\(\s*[,;\s]+/g, "(") // leading punctuation residue inside parens
    .replace(/\s+([.,;:)])/g, "$1") // tidy space left before punctuation
    .replace(/([,;])\1+/g, "$1") // collapsed duplicate separators
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Render the readable payload of the handful of inline templates that carry
 * prose values, so stripping them doesn't leave gaps like "weighs and is long".
 * Everything else collapses to empty.
 */
function unwrapTemplate(tpl: string): string {
  const inner = tpl.slice(2, -2);
  const parts = inner.split("|");
  const name = parts[0].trim().toLowerCase();
  const args = parts.slice(1).filter((p) => !p.includes("=")); // drop named args

  if (name === "convert" || name === "cvt") {
    // Keep the input value(s) and the first unit; drop the converted duplicate.
    // {{convert|2.5|5|kg|lb}} → "2.5–5 kg"; {{convert|1.5|m}} → "1.5 m".
    const nums: string[] = [];
    let unit = "";
    for (const a of args) {
      const t = a.trim();
      if (/^-?\d[\d.,]*$/.test(t)) nums.push(t);
      else if (/^(to|-|–|and|by|x|×|±)$/i.test(t)) nums.push("–");
      else {
        unit = t;
        break;
      }
    }
    const value = nums.length === 2 ? nums.join("–") : nums.join(" ");
    return `${value} ${unit}`.replace(/\s*–\s*/g, "–").trim();
  }
  if (["lang", "transl", "transliteration"].includes(name)) {
    return args[args.length - 1] ?? ""; // last positional is the text
  }
  if (["nowrap", "nobr", "sic", "'"].includes(name)) return args.join(" ");
  return "";
}

/** A sentence worth auditing: real prose, not a stub of leftover markup. */
function isAuditable(text: string): boolean {
  if (text.length < 25) return false; // too short to be a claim
  const letters = text.replace(/[^a-zA-Z]/g, "").length;
  return letters >= 15 && /[a-z]/.test(text); // has real words
}

// --- Tally -----------------------------------------------------------------

function tally(sections: AuditSection[]): ArticleAudit["summary"] {
  const body = emptyTally();
  const lead = emptyTally();
  for (const sec of sections) {
    const t = sec.isLead ? lead : body;
    for (const c of sec.claims) {
      t.total++;
      if (c.status === "sourced") t.sourced++;
      else if (c.status === "note-only") t.noteOnly++;
      else t.unsourced++;
    }
  }
  const coverage = body.total === 0 ? 1 : body.sourced / body.total;
  return { body, lead, coverage };
}

function emptyTally(): AuditTally {
  return { total: 0, sourced: 0, noteOnly: 0, unsourced: 0 };
}
