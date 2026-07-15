import type {
  ArticleAudit,
  AuditClaim,
  AuditSection,
  AuditTally,
  SentenceStatus,
} from "@/types/ArticleAudit";
import {
  classifyInline,
  indexRefDefinitions,
  maskedRanges,
  unwrapTemplate,
} from "./blame.ts";
import { WikipediaClient, type FetchJson } from "./wikipedia.ts";
import type { EngineCache } from "./cache.ts";
import type { Stage } from "./metrics.ts";

export interface AuditInput {
  article: string;
  lang?: string;
  fetchJson?: FetchJson;
  cache?: EngineCache;
  onStage?: (stage: Stage) => void;
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

  const current = await client.getCurrentContent(input.article).catch((err) => {
    if (err instanceof Error && /not found/i.test(err.message)) {
      throw new ArticleNotFoundError(input.article, lang);
    }
    throw err;
  });

  if (!current) throw new ArticleNotFoundError(input.article, lang);
  input.onStage?.("read");

  const sections = segmentArticle(current.content);

  const summary = tally(sections);
  input.onStage?.("assemble");

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

const APPARATUS =
  /^(references?|notes?|footnotes?|citations?|sources?|bibliography|further reading|external links?|see also|works cited|explanatory notes?)$/i;

interface RawSection {
  heading: string;
  level: number;
  isLead: boolean;
  body: string;
}

export function segmentArticle(wikitext: string): AuditSection[] {
  const clean = wikitext
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!--[\s\S]*$/g, "");

  const refDefs = indexRefDefinitions(clean);

  const raw = splitSections(clean);

  const out: AuditSection[] = [];

  let counter = 0;

  for (const sec of raw) {
    if (!sec.isLead && APPARATUS.test(sec.heading.trim())) continue;

    const claims: AuditClaim[] = [];

    for (const sentence of sentences(sec.body)) {
      const display = cleanProse(sentence);

      if (!isAuditable(display)) continue;

      const det = classifyInline(sentence, refDefs);

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
        ...(status === "sourced" && det.source == null
          ? { refUnparsed: true }
          : {}),
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

export function bodySections(
  wikitext: string,
): { heading: string; body: string }[] {
  const clean = wikitext
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!--[\s\S]*$/g, "");

  return splitSections(clean)
    .filter((sec) => !sec.isLead && !APPARATUS.test(sec.heading.trim()))
    .map((sec) => ({ heading: sec.heading, body: sec.body }));
}

function splitSections(text: string): RawSection[] {
  const headingRe = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;
  const sections: RawSection[] = [];

  let lastIndex = 0;

  let pending: { heading: string; level: number } | null = null;

  const push = (
    body: string,
    meta: { heading: string; level: number } | null,
  ) => {
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

function proseLines(body: string): string[] {
  const withoutTables = stripMediaLinks(stripTables(body));

  const paras: string[] = [];

  for (const block of withoutTables.split(/\n{2,}/)) {
    const kept: string[] = [];

    for (const line of block.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      if (/^[*#:;!|]/.test(t)) continue;
      if (/^\{\{/.test(t) && /\}\}$/.test(t)) continue;
      if (/^(={2,6})\s*.+\1$/.test(t)) continue;
      if (/^<\/?(gallery|table|blockquote|div|ref|references)/i.test(t))
        continue;
      kept.push(line);
    }

    if (kept.length) paras.push(kept.join(" "));
  }
  return paras;
}

const MEDIA_NS =
  /^(?:file|image|category|media|ficheiro|imagem|arquivo|categoria|mídia|multimídia)$/i;

function stripMediaLinks(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "[" && text[i + 1] === "[") {
      let depth = 1;

      let j = i + 2;

      while (j < text.length && depth > 0) {
        if (text[j] === "[" && text[j + 1] === "[") {
          depth++;
          j += 2;
        } else if (text[j] === "]" && text[j + 1] === "]") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }

      if (depth > 0) {
        out += text[i];
        i++;
        continue;
      }

      const ns = text
        .slice(i + 2, j - 2)
        .match(/^\s*([^:|[\]]+)\s*:/)?.[1]
        ?.trim();

      if (ns && MEDIA_NS.test(ns)) {
        i = j;
        continue;
      }

      out += text.slice(i, j);

      i = j;

      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

function stripTables(text: string): string {
  let out = "";

  let depth = 0;

  let openAt = -1;

  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === "{|") {
      if (depth === 0) openAt = i;
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

  if (depth > 0 && openAt >= 0) out += text.slice(openAt);

  return out;
}

const ABBR = new Set([
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
  "c",
  "ca",
  "fig",
  "gen",
  "sen",
  "rep",
  "gov",
  "col",
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

function splitSentences(para: string): string[] {
  const masked = maskString(para);

  const ranges = maskedRanges(para);

  const out: string[] = [];

  let start = 0;

  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];

    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    let j = i;

    while (j + 1 < masked.length && ".!?".includes(masked[j + 1])) j++;

    if (ch === "." && /\d/.test(masked[i + 1] ?? "")) {
      i = j;
      continue;
    }

    if (ch === "." && isAbbrevBefore(masked, i)) {
      i = j;
      continue;
    }

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

function swallowTrailing(
  from: number,
  para: string,
  ranges: [number, number][],
): number {
  let end = from;

  for (;;) {
    let p = end;

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

function isAbbrevBefore(text: string, i: number): boolean {
  const before = text.slice(Math.max(0, i - 12), i);

  const word = before.match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase() ?? "";

  if (!word) return false;

  if (ABBR.has(word)) return true;

  const rawWord =
    text.slice(Math.max(0, i - 12), i).match(/([A-Za-z.]+)$/)?.[1] ?? "";
  return /^[A-Z]$/.test(rawWord);
}

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

export function cleanProse(sentence: string): string {
  return sentence
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, unwrapTemplate)
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]]*\|)?([^\]|]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\([^A-Za-z0-9]*\)/g, "")
    .replace(/\(\s*[,;\s]+/g, "(")
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/([,;])\1+/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .trim();
}

function isAuditable(text: string): boolean {
  if (text.length < 25) return false;

  const letters = text.replace(/[^a-zA-Z]/g, "").length;

  return letters >= 15 && /[a-z]/.test(text);
}

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
