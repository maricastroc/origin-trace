import {
  detectRefNear,
  findIntroduction,
  normalize,
  type ContentReader,
} from "./blame.ts";
import { cleanProse, sentences } from "./audit.ts";
import { extractAnchors, sharedAnchors, type Anchor } from "./anchors.ts";
import { ClaimNotFoundError } from "./trace.ts";
import type { ClaimSource } from "@/types/ClaimSource";
import {
  WikipediaClient,
  type FetchJson,
  type RevisionMeta,
} from "./wikipedia.ts";
import type { EngineCache } from "./cache.ts";

export type Terminus =
  | "origin:fresh-insertion"
  | "origin:first-revision"
  | "origin:bulk-insertion"
  | "broke:structured-genesis"
  | "broke:cross-article-merge"
  | "broke:no-anchor-reword"
  | "broke:low-overlap"
  | "broke:anchors-elsewhere"
  | "broke:no-anchors";

const RESIDUAL_SHAPE: Record<
  Terminus,
  "resolved" | "more-determinism" | "semantic" | "unrecoverable"
> = {
  "origin:fresh-insertion": "resolved",
  "origin:first-revision": "resolved",
  "origin:bulk-insertion": "resolved",
  "broke:structured-genesis": "more-determinism",
  "broke:cross-article-merge": "more-determinism",
  "broke:no-anchor-reword": "semantic",
  "broke:low-overlap": "semantic",
  "broke:anchors-elsewhere": "semantic",
  "broke:no-anchors": "unrecoverable",
};

export function residualShape(
  t: Terminus,
): "resolved" | "more-determinism" | "semantic" | "unrecoverable" {
  return RESIDUAL_SHAPE[t];
}

export interface GenealogyHop {
  wording: string;
  revId: number
  parentId: number;
  date: string;
  sourced: boolean;
  sourceLabel: string | null;
  source: ClaimSource | null;
  anchorsShared: string[];
  overlap?: number;
}

export interface OriginPoint {
  revId: number;
  date: string;
  sourced: boolean;
}

export interface Genealogy {
  article: string;
  phrase: string;
  lexicalOrigin: OriginPoint;
  origin: OriginPoint;
  chain: GenealogyHop[];
  terminus: Terminus;
  movedEarlier: boolean;
  verdictShift: { from: string; to: string } | null;
  nonMonotonic: boolean;
  stopOverlap: number | null;
  contentFetches: number;
  notes: string[];
}

export interface GenealogyInput {
  article: string;
  phrase: string;
  lang?: string;
  maxPages?: number;
  fetchJson?: FetchJson;
  cache?: EngineCache;
  overlapMin?: number;
  onHop?: (hop: number) => void;
  /** A revision listing already fetched by the caller. When present the walk
   *  skips its own {@link WikipediaClient.listRevisions} — the trace passes the
   *  list its introduction search already built. */
  revisions?: RevisionMeta[];
  /** A content reader (with its request-scoped cache) already warmed by the
   *  caller's search. When present the walk reads through it instead of a fresh
   *  one, so a revision the search downloaded is never downloaded again. */
  read?: ContentReader;
}

const MAX_HOPS = 40;
const MASS_INSERTION_SENTENCES = 40;
const OVERLAP_DEFAULT = 0.55;
const MERGE_RE =
  /\b(merged?|merging|split from|split to|splitting|imported from|copied from|moved from)\b/i;

export async function reconstructGenealogy(
  input: GenealogyInput,
): Promise<Genealogy> {
  const client = new WikipediaClient({
    lang: input.lang ?? "en",
    maxPages: input.maxPages,
    fetchJson: input.fetchJson,
    cache: input.cache,
  });

  const contentCache = new Map<number, string | null>();
  let fetches = 0;

  const ownRead: ContentReader = async (revid) => {
    if (contentCache.has(revid)) return contentCache.get(revid)!;

    const content = await client.getRevisionContent(revid);

    contentCache.set(revid, content);

    fetches += 1;

    return content;
  };
  ownRead.prefetch = async (revids) => {
    const missing = revids.filter((r) => !contentCache.has(r));

    if (missing.length === 0) return;

    const batch = await client.getContentBatch(missing);

    for (const r of missing) contentCache.set(r, batch.get(r) ?? null);

    fetches += missing.length;
  };

  const read = input.read ?? ownRead;
  const revisions =
    input.revisions ?? (await client.listRevisions(input.article)).revisions;
  if (revisions.length === 0)
    throw new ClaimNotFoundError(input.article, input.phrase);

  const notes: string[] = [
    "Earlier-existence is probed against the immediate parent revision only; deeper anchor persistence is not traced in this slice.",
  ];

  const titleTokens = titleTokenSet(input.article);
  const overlapMin = input.overlapMin ?? OVERLAP_DEFAULT;

  let window: RevisionMeta[] = revisions;

  let current = input.phrase;

  const chain: GenealogyHop[] = [];

  let nonMonotonic = false;

  let stopOverlap: number | null = null;

  let lexicalOrigin: OriginPoint | null = null;

  let origin: OriginPoint | null = null;

  let terminus: Terminus = "broke:anchors-elsewhere";

  for (let guard = 0; guard < MAX_HOPS; guard++) {
    input.onHop?.(guard);
    const intro = await findIntroduction(window, current, read);
    if (!intro) {
      if (chain.length === 0)
        throw new ClaimNotFoundError(input.article, input.phrase);
      terminus = "broke:anchors-elsewhere";
      origin = chain[chain.length - 1] && originOf(chain[chain.length - 1]);
      break;
    }
    if (intro.assumptionViolated) nonMonotonic = true;

    const introContent = (await read(intro.revision.revid)) ?? "";
    const cur = locateSentence(introContent, current) ?? cleanProse(current);
    const ref = detectRefNear(introContent, current);

    const hop: GenealogyHop = {
      wording: cur,
      revId: intro.revision.revid,
      parentId: intro.revision.parentid,
      date: yearMonth(intro.revision.timestamp),
      sourced: ref.sourced,
      sourceLabel: ref.source?.label ?? null,
      source: ref.source,
      anchorsShared: [],
    };
    if (chain.length === 0) lexicalOrigin = originOf(hop);


    if (intro.index === 0 || !intro.priorRevision) {
      chain.push(hop);
      origin = originOf(hop);
      terminus = "origin:first-revision";
      break;
    }

    const parentRev = window[intro.index - 1];

    const parentContent = (await read(parentRev.revid)) ?? "";

    const link = findPredecessor(
      parentContent,
      introContent,
      cur,
      intro.revision.comment,
      titleTokens,
      overlapMin,
    );

    if (link.kind === "link") {
      hop.anchorsShared = link.anchors.map((a) => a.value);

      hop.overlap = link.overlap;

      chain.push(hop);

      current = link.predecessor;

      window = window.slice(0, intro.index);

      continue;
    }

    chain.push(hop);

    origin = originOf(hop);

    if (link.nonMonotonic) nonMonotonic = true;

    if (link.overlap !== undefined) stopOverlap = link.overlap;

    terminus = link.terminus;

    break;
  }

  if (!lexicalOrigin || !origin) {
    const tail = chain[chain.length - 1];

    lexicalOrigin =
      lexicalOrigin ??
      (chain[0] ? originOf(chain[0]) : { revId: 0, date: "?", sourced: false });

    origin = origin ?? (tail ? originOf(tail) : lexicalOrigin);

    nonMonotonic = true;

    notes.push("Hop limit reached; chain may be incomplete.");
  }

  const movedEarlier = origin.revId !== lexicalOrigin.revId;

  let verdictShift: Genealogy["verdictShift"] = null;

  if (movedEarlier) {
    const from = lexicalOrigin.sourced ? "born-sourced" : "unsourced-at-origin";

    const to = origin.sourced ? "born-sourced" : "unsourced-at-origin";

    if (from !== to) verdictShift = { from, to };
  }

  return {
    article: input.article,
    phrase: input.phrase,
    lexicalOrigin,
    origin,
    chain,
    terminus,
    movedEarlier,
    verdictShift,
    nonMonotonic,
    stopOverlap,
    contentFetches: fetches,
    notes,
  };
}

function originOf(hop: GenealogyHop): OriginPoint {
  return { revId: hop.revId, date: hop.date, sourced: hop.sourced };
}

type Link =
  | { kind: "link"; predecessor: string; anchors: Anchor[]; overlap: number }
  | {
      kind: "stop";
      terminus: Terminus;
      nonMonotonic?: boolean;
      overlap?: number;
    };

interface Seg {
  clean: string;
  norm: string;
}

function segments(content: string): Seg[] {
  const out: Seg[] = [];

  for (const raw of sentences(content)) {
    const clean = cleanProse(raw);

    const norm = normalize(clean);

    if (norm) out.push({ clean, norm });
  }
  return out;
}

function findPredecessor(
  parentContent: string,
  revContent: string,
  cur: string,
  comment: string | undefined,
  titleTokens: Set<string>,
  overlapMin: number,
): Link {
  const target = normalize(cur);

  const parent = segments(parentContent);

  const rev = segments(revContent);

  const netAdded = rev.length - parent.length;

  const biTarget = rev.findIndex(
    (s) => s.norm === target || s.norm.includes(target),
  );

  if (biTarget < 0) {
    return {
      kind: "stop",
      terminus: classifyInsertion(
        cur,
        parent,
        parentContent,
        comment,
        netAdded,
        titleTokens,
      ),
    };
  }

  const ops = diffOps(
    parent.map((s) => s.norm),
    rev.map((s) => s.norm),
  );

  const at = ops.findIndex((o) => o.t === "ins" && o.bi === biTarget);

  if (at < 0) {
    return {
      kind: "stop",
      terminus: classifyInsertion(
        cur,
        parent,
        parentContent,
        comment,
        netAdded,
        titleTokens,
      ),
      nonMonotonic: true,
    };
  }

  let lo = at;

  let hi = at;

  while (lo - 1 >= 0 && ops[lo - 1].t !== "match") lo--;

  while (hi + 1 < ops.length && ops[hi + 1].t !== "match") hi++;

  const dels: string[] = [];

  for (let k = lo; k <= hi; k++) {
    const op = ops[k];

    if (op.t === "del") dels.push(parent[op.ai].clean);
  }

  if (dels.length === 0) {
    return {
      kind: "stop",
      terminus: classifyInsertion(
        cur,
        parent,
        parentContent,
        comment,
        netAdded,
        titleTokens,
      ),
    };
  }

  let best: { predecessor: string; anchors: Anchor[] } | null = null;
  
  for (const del of dels) {
    const anchors = guardShared(cur, del, titleTokens);

    if (anchors.length > (best?.anchors.length ?? 0))
      best = { predecessor: del, anchors };
  }
  if (best && strongEnough(best.anchors)) {
    const overlap = contentOverlap(cur, best.predecessor);

    if (overlap >= overlapMin) {
      return {
        kind: "link",
        predecessor: best.predecessor,
        anchors: best.anchors,
        overlap,
      };
    }

    return { kind: "stop", terminus: "broke:low-overlap", overlap };
  }
  return { kind: "stop", terminus: "broke:no-anchor-reword" };
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "nor",
  "if",
  "so",
  "yet",
  "as",
  "than",
  "because",
  "while",
  "although",
  "though",
  "whereas",
  "whether",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "from",
  "with",
  "into",
  "onto",
  "upon",
  "about",
  "over",
  "under",
  "above",
  "below",
  "between",
  "among",
  "through",
  "during",
  "before",
  "after",
  "since",
  "until",
  "against",
  "toward",
  "towards",
  "within",
  "without",
  "across",
  "it",
  "its",
  "he",
  "him",
  "his",
  "she",
  "her",
  "hers",
  "they",
  "them",
  "their",
  "we",
  "us",
  "our",
  "i",
  "me",
  "my",
  "you",
  "your",
  "this",
  "that",
  "these",
  "those",
  "which",
  "who",
  "whom",
  "whose",
  "what",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "has",
  "have",
  "had",
  "having",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "not",
  "no",
  "only",
  "also",
  "just",
  "then",
  "there",
  "here",
  "when",
  "where",
  "how",
  "why",
  "very",
  "too",
  "more",
  "most",
  "much",
  "many",
  "some",
  "any",
  "all",
  "both",
  "each",
  "every",
  "other",
  "another",
  "such",
  "same",
  "own",
  "up",
  "down",
  "out",
  "off",
  "again",
  "once",
]);

function contentWords(s: string): Set<string> {
  const set = new Set<string>();
  for (const w of normalize(s).split(" ")) {
    if (w && !STOP_WORDS.has(w)) set.add(w);
  }
  return set;
}

function contentOverlap(a: string, b: string): number {
  const A = contentWords(a);

  const B = contentWords(b);

  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;

  for (const w of A) if (B.has(w)) inter++;

  return (2 * inter) / (A.size + B.size);
}

function strongEnough(anchors: Anchor[]): boolean {
  return anchors.some((a) => a.kind === "number") || anchors.length >= 2;
}

function titleTokenSet(article: string): Set<string> {
  return new Set(
    article
      .toLowerCase()
      .split(/[\s_]+/)
      .map((t) => t.replace(/[^a-z0-9']/g, ""))
      .filter(Boolean),
  );
}

function guardShared(a: string, b: string, title: Set<string>): Anchor[] {
  return sharedAnchors(a, b).filter(
    (anchor) => !(anchor.kind === "name" && title.has(anchor.value)),
  );
}

function classifyInsertion(
  cur: string,
  parent: Seg[],
  parentContent: string,
  comment: string | undefined,
  netAdded: number,
  titleTokens: Set<string>,
): Terminus {
  if (comment && MERGE_RE.test(comment)) return "broke:cross-article-merge";

  if (netAdded >= MASS_INSERTION_SENTENCES) return "origin:bulk-insertion";

  if (extractAnchors(cur).length === 0) return "broke:no-anchors";

  if (
    parent.some((s) => strongEnough(guardShared(cur, s.clean, titleTokens)))
  ) {
    return "broke:anchors-elsewhere";
  }

  if (
    strongEnough(guardShared(cur, structuredText(parentContent), titleTokens))
  ) {
    return "broke:structured-genesis";
  }
  return "origin:fresh-insertion";
}

function structuredText(content: string): string {
  const body = content
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<ref[^>]*\/>/g, " ");

  const parts: string[] = [];

  for (const m of body.matchAll(/\{\|[\s\S]*?\|\}/g)) parts.push(m[0]);

  for (const m of body.matchAll(/\{\{[\s\S]*?\}\}/g)) parts.push(m[0]);

  for (const line of body.split("\n")) {
    const t = line.trim();
    if (/^[*#|]/.test(t)) parts.push(t);
  }

  return parts.join("\n");
}

type Op =
  | { t: "match"; ai: number; bi: number }
  | { t: "del"; ai: number }
  | { t: "ins"; bi: number };

function diffOps(a: string[], b: string[]): Op[] {
  const m = a.length;

  const n = b.length;

  const dp: Int32Array[] = Array.from(
    { length: m + 1 },
    () => new Int32Array(n + 1),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: Op[] = [];

  let i = 0;

  let j = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ t: "match", ai: i, bi: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: "del", ai: i });
      i++;
    } else {
      ops.push({ t: "ins", bi: j });
      j++;
    }
  }
  while (i < m) ops.push({ t: "del", ai: i++ });

  while (j < n) ops.push({ t: "ins", bi: j++ });
  return ops;
}

function locateSentence(content: string, phrase: string): string | null {
  const target = normalize(phrase);

  if (!target) return null;

  for (const raw of sentences(content)) {
    const clean = cleanProse(raw);
    if (normalize(clean).includes(target)) return clean;
  }
  
  return null;
}

function yearMonth(timestamp: string): string {
  return timestamp.slice(0, 7) || "?";
}
