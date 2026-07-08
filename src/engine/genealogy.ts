// Diff genealogy — Camada 1.
//
// The lexical trace (findIntroduction) answers "when did *this wording* first
// appear?". Genealogy answers the question the product name actually promises:
// "when did *this idea* first appear?". It walks backward from the lexical
// origin, and at each step asks "what wording did this one physically replace?"
// by reading the diff of the introducing edit. The link it draws is *textual
// descent* — X replaced Y, same slot, one edit, sharing a stable anchor — never
// a semantic claim of sameness. Every hop is the existing O(log n) bisection.
//
// The walk always ends in exactly one `Terminus`. That taxonomy is the whole
// point of this slice: it measures how much of the "wordings change" problem
// the revision graph resolves on its own, and — for what it can't — of *which
// shape* the residual is (determinism-reachable vs. genuinely semantic vs.
// unrecoverable). No LLM anywhere.

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
  | "origin:fresh-insertion" // reached a wording written from nothing — the idea's real birth
  | "origin:first-revision" // present in the article's first revision
  | "origin:bulk-insertion" // entered in a large batch edit (no merge marker) — a found, if low-confidence, entry point
  | "broke:structured-genesis" // no prose predecessor, but anchors live in infobox/table/list at the parent
  | "broke:cross-article-merge" // introducing edit is a declared merge/import — lineage crosses into another article
  | "broke:no-anchor-reword" // a positional replacement exists but shares no anchor — can't prove same idea
  | "broke:low-overlap" // strong anchor, but the two sentences share too little content — abstain rather than assert a shaky link
  | "broke:anchors-elsewhere" // anchors appear earlier in prose but not via a replacement chain
  | "broke:no-anchors"; // the claim carries no stable anchor to trace on

const RESIDUAL_SHAPE: Record<Terminus, "resolved" | "more-determinism" | "semantic" | "unrecoverable"> = {
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

export function residualShape(t: Terminus): "resolved" | "more-determinism" | "semantic" | "unrecoverable" {
  return RESIDUAL_SHAPE[t];
}

export interface GenealogyHop {
  wording: string; // the cleaned sentence of this generation
  revId: number; // revision that introduced this wording
  parentId: number;
  date: string; // YYYY-MM
  sourced: boolean; // was it cited at introduction?
  sourceLabel: string | null;
  source: ClaimSource | null; // full citation at this revision (for rendering a SourceChip)
  anchorsShared: string[]; // anchors linking this wording to the older wording it descended from (empty on the origin)
  overlap?: number; // content-word Dice with the wording it descended from (undefined on the origin)
}

export interface OriginPoint {
  revId: number;
  date: string;
  sourced: boolean;
}

export interface Genealogy {
  article: string;
  phrase: string;
  lexicalOrigin: OriginPoint; // what the current engine reports today (chain head)
  origin: OriginPoint; // the deepest wording reached (chain tail)
  chain: GenealogyHop[]; // newest → oldest; chain[0] is the current wording, last is the origin
  terminus: Terminus;
  movedEarlier: boolean; // did genealogy push the origin earlier than the lexical trace?
  verdictShift: { from: string; to: string } | null; // e.g. born-sourced → unsourced-at-origin
  nonMonotonic: boolean; // a hop hit a non-monotonic boundary; chain is suggestive, not proven
  stopOverlap: number | null; // if the chain stopped on a low-overlap link, the Dice that fell short (for calibration)
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
  overlapMin?: number; // content-word Dice floor for a link (default 0.55); below it the chain abstains
  onHop?: (hop: number) => void; // progress: called at the start of each backward hop
}

const MAX_HOPS = 40; // runaway guard; real reformulation chains are short
const MASS_INSERTION_SENTENCES = 40; // one edit adding this many sentences reads as an import, not a reword
const OVERLAP_DEFAULT = 0.55; // conservative: a false genealogical link is worse than a chain that stops early
const MERGE_RE =
  /\b(merged?|merging|split from|split to|splitting|imported from|copied from|moved from)\b/i;

export async function reconstructGenealogy(input: GenealogyInput): Promise<Genealogy> {
  const client = new WikipediaClient({
    lang: input.lang ?? "en",
    maxPages: input.maxPages,
    fetchJson: input.fetchJson,
    cache: input.cache,
  });

  const contentCache = new Map<number, string | null>();
  let fetches = 0;
  const read: ContentReader = async (revid) => {
    if (contentCache.has(revid)) return contentCache.get(revid)!;
    const content = await client.getRevisionContent(revid);
    contentCache.set(revid, content);
    fetches += 1;
    return content;
  };

  const { revisions } = await client.listRevisions(input.article);
  if (revisions.length === 0) throw new ClaimNotFoundError(input.article, input.phrase);

  const notes: string[] = [
    "Earlier-existence is probed against the immediate parent revision only; deeper anchor persistence is not traced in this slice.",
  ];

  const titleTokens = titleTokenSet(input.article);
  const overlapMin = input.overlapMin ?? OVERLAP_DEFAULT;
  let window: RevisionMeta[] = revisions;
  let current = input.phrase; // search string for this generation
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
      // hop 0: the phrase isn't in the article at all. Later hops: a predecessor
      // was read from a diff but its own introduction couldn't be pinned.
      if (chain.length === 0) throw new ClaimNotFoundError(input.article, input.phrase);
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

    // Reached the first revision — the idea is as old as the article.
    if (intro.index === 0 || !intro.priorRevision) {
      chain.push(hop);
      origin = originOf(hop);
      terminus = "origin:first-revision";
      break;
    }

    const parentRev = window[intro.index - 1];
    const parentContent = (await read(parentRev.revid)) ?? "";
    const link = findPredecessor(parentContent, introContent, cur, intro.revision.comment, titleTokens, overlapMin);

    if (link.kind === "link") {
      hop.anchorsShared = link.anchors.map((a) => a.value);
      hop.overlap = link.overlap;
      chain.push(hop);
      current = link.predecessor;
      window = window.slice(0, intro.index); // predecessor lives strictly earlier
      continue;
    }

    // Terminal: no provable predecessor. `link` carries the classified terminus.
    chain.push(hop);
    origin = originOf(hop);
    if (link.nonMonotonic) nonMonotonic = true;
    if (link.overlap !== undefined) stopOverlap = link.overlap;
    terminus = link.terminus;
    break;
  }

  if (!lexicalOrigin || !origin) {
    // Only reachable if the runaway guard tripped before any terminal branch.
    const tail = chain[chain.length - 1];
    lexicalOrigin = lexicalOrigin ?? (chain[0] ? originOf(chain[0]) : { revId: 0, date: "?", sourced: false });
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

// --- predecessor detection via sentence-level diff -------------------------

type Link =
  | { kind: "link"; predecessor: string; anchors: Anchor[]; overlap: number }
  | { kind: "stop"; terminus: Terminus; nonMonotonic?: boolean; overlap?: number };

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

  const biTarget = rev.findIndex((s) => s.norm === target || s.norm.includes(target));
  if (biTarget < 0) {
    // Couldn't re-locate the sentence structurally — fall back to a classification.
    return { kind: "stop", terminus: classifyInsertion(cur, parent, parentContent, comment, netAdded, titleTokens) };
  }

  const ops = diffOps(
    parent.map((s) => s.norm),
    rev.map((s) => s.norm),
  );

  const at = ops.findIndex((o) => o.t === "ins" && o.bi === biTarget);
  if (at < 0) {
    // The sentence already existed verbatim in the parent — findIntroduction's
    // monotonicity assumption slipped. Suggestive, not proven.
    return {
      kind: "stop",
      terminus: classifyInsertion(cur, parent, parentContent, comment, netAdded, titleTokens),
      nonMonotonic: true,
    };
  }

  // Expand to the maximal non-match block around the inserted sentence.
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
    // Pure insertion — no wording was displaced here.
    return { kind: "stop", terminus: classifyInsertion(cur, parent, parentContent, comment, netAdded, titleTokens) };
  }

  // A replacement happened. Keep it only if the shared anchors are strong enough
  // to prove same-idea descent — otherwise it's an unprovable reword.
  let best: { predecessor: string; anchors: Anchor[] } | null = null;
  for (const del of dels) {
    const anchors = guardShared(cur, del, titleTokens);
    if (anchors.length > (best?.anchors.length ?? 0)) best = { predecessor: del, anchors };
  }
  if (best && strongEnough(best.anchors)) {
    // Fine filter: even with a strong shared anchor, only trust the link if the
    // two sentences still share most of their content. A long identical subject
    // clause with a changed predicate ("Paine treated ophthalmia" vs "Paine
    // attempted sycosis") passes the anchor guard but fails here — so we abstain.
    const overlap = contentOverlap(cur, best.predecessor);
    if (overlap >= overlapMin) {
      return { kind: "link", predecessor: best.predecessor, anchors: best.anchors, overlap };
    }
    return { kind: "stop", terminus: "broke:low-overlap", overlap };
  }
  return { kind: "stop", terminus: "broke:no-anchor-reword" };
}

// Function words dropped before measuring overlap, so shared scaffolding ("the",
// "was", "in") can't inflate the similarity of two different claims. Numbers are
// kept — a shared quantity is real content.
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "if", "so", "yet", "as", "than",
  "because", "while", "although", "though", "whereas", "whether", "of", "to",
  "in", "on", "at", "by", "for", "from", "with", "into", "onto", "upon", "about",
  "over", "under", "above", "below", "between", "among", "through", "during",
  "before", "after", "since", "until", "against", "toward", "towards", "within",
  "without", "across", "it", "its", "he", "him", "his", "she", "her", "hers",
  "they", "them", "their", "we", "us", "our", "i", "me", "my", "you", "your",
  "this", "that", "these", "those", "which", "who", "whom", "whose", "what",
  "is", "are", "was", "were", "be", "been", "being", "am", "has", "have", "had",
  "having", "do", "does", "did", "will", "would", "shall", "should", "can",
  "could", "may", "might", "must", "not", "no", "only", "also", "just", "then",
  "there", "here", "when", "where", "how", "why", "very", "too", "more", "most",
  "much", "many", "some", "any", "all", "both", "each", "every", "other",
  "another", "such", "same", "own", "up", "down", "out", "off", "again", "once",
]);

function contentWords(s: string): Set<string> {
  const set = new Set<string>();
  for (const w of normalize(s).split(" ")) {
    if (w && !STOP_WORDS.has(w)) set.add(w);
  }
  return set;
}

// Dice coefficient over content-word sets ∈ [0,1]. Fully deterministic: fixed
// stopword list, set intersection, no NLP, no model.
function contentOverlap(a: string, b: string): number {
  const A = contentWords(a);
  const B = contentWords(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// One shared token isn't proof: the article subject appears in nearly every
// sentence, so a lone shared *name* would chain rewords together spuriously. A
// shared *number* (year, quantity) is specific enough on its own; a shared name
// needs corroboration (≥2 anchors).
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

// Shared anchors that actually discriminate: the article subject ("Great Wall
// of China", "Pluto") appears in nearly every sentence, so its name tokens are
// dropped — otherwise a lead sentence trivially "matches earlier" on its own
// title. Numbers are never dropped (a year in a title is rare and still specific).
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
  // A declared merge/import — the lineage genuinely continues in another article.
  if (comment && MERGE_RE.test(comment)) return "broke:cross-article-merge";
  // A large batch edit with no merge marker — usually early article-building, not
  // a cross-article merge. The wording entered here; we just can't rule out an
  // uncredited paste, so it's a found (if low-confidence) origin, not a break.
  if (netAdded >= MASS_INSERTION_SENTENCES) return "origin:bulk-insertion";
  if (extractAnchors(cur).length === 0) return "broke:no-anchors";

  // Strong anchors already present in the parent's *prose* → the idea existed
  // earlier but wasn't the positional predecessor (split/merge/move/drift).
  // Subject-name tokens are excluded so a lead sentence doesn't match its own title.
  if (parent.some((s) => strongEnough(guardShared(cur, s.clean, titleTokens)))) {
    return "broke:anchors-elsewhere";
  }

  // Strong anchors in the parent's *structured* regions (infobox params, table
  // cells, list items) → the fact lived as data before it was prosified.
  if (strongEnough(guardShared(cur, structuredText(parentContent), titleTokens))) {
    return "broke:structured-genesis";
  }

  // Nothing earlier carries the anchors — this wording is the idea's real birth.
  return "origin:fresh-insertion";
}

// Structured (non-prose) markup where a fact commonly lives before an editor
// turns it into a sentence: infobox/template parameters and table cells
// (`| founded = 1998`), list items (`* …`, `# …`), `{| … |}` tables, and
// single-line templates. Citations are stripped first so a source's year can't
// masquerade as structured data.
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

// --- longest-common-subsequence over sentence lists ------------------------

type Op = { t: "match"; ai: number; bi: number } | { t: "del"; ai: number } | { t: "ins"; bi: number };

function diffOps(a: string[], b: string[]): Op[] {
  const m = a.length;
  const n = b.length;
  const dp: Int32Array[] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
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

// --- small helpers ---------------------------------------------------------

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
