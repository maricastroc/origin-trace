import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { ClaimSource } from "@/types/ClaimSource";
import type { TimelineEvent } from "@/types/TimelineEvent";
import type { Verdict } from "@/types/Verdict";
import type { VerdictReading } from "@/types/VerdictReading";
import type { EventKind } from "@/types/EventKind";
import type { ChangeTag } from "@/types/ChangeTag";
import type { SearchProbe } from "@/types/SearchProbe";
import type { SearchTrace } from "@/types/SearchTrace";
import {
  anchorIndex,
  detectRefNear,
  findIntroduction,
  normalize,
  type ContentReader,
} from "./blame.ts";
import {
  reconstructGenealogy,
  residualShape,
  type GenealogyHop,
} from "./genealogy.ts";
import { cleanProse, sentences } from "./audit.ts";
import { verdictConfidence } from "./confidence.ts";
import {
  WikipediaClient,
  type FetchJson,
  type RevisionMeta,
} from "./wikipedia.ts";
import type { EngineCache } from "./cache.ts";
import type { Stage } from "./metrics.ts";

export type TraceProgress =
  | { phase: "listing" }
  | { phase: "listed"; revisions: number; truncated: boolean }
  | { phase: "searching"; read: number; estimate: number; probe?: SearchProbe }
  | { phase: "located"; year: string; removed: boolean }
  | { phase: "reading" }
  | { phase: "detecting" }
  | { phase: "genealogy"; hop: number };

export interface TraceInput {
  article: string;
  phrase: string;
  lang?: string;
  claimText?: string;
  maxPages?: number;
  fetchJson?: FetchJson;
  cache?: EngineCache;
  onProgress?: (progress: TraceProgress) => void;
  /** Coarse stage boundaries for timing. Fired once per stage as it closes;
   *  a {@link TraceProfiler} timestamps them. Additive and optional. */
  onStage?: (stage: Stage) => void;
}

export class ClaimNotFoundError extends Error {
  readonly article: string;
  readonly phrase: string;
  constructor(article: string, phrase: string) {
    super(`Phrase not found in "${article}": ${JSON.stringify(phrase)}`);
    this.name = "ClaimNotFoundError";
    this.article = article;
    this.phrase = phrase;
  }
}

export async function traceClaim(input: TraceInput): Promise<ClaimProvenance> {
  const lang = input.lang ?? "en";
  const client = new WikipediaClient({
    lang,
    maxPages: input.maxPages,
    fetchJson: input.fetchJson,
    cache: input.cache,
  });

  const emit = input.onProgress ?? (() => {});
  const stage = input.onStage ?? (() => {});
  let phase: "searching" | "reading" = "searching";
  let reads = 0;
  let estimate = 12;
  const probes: SearchProbe[] = [];

  const cache = new Map<number, string | null>();
  const read: ContentReader = async (revid) => {
    if (cache.has(revid)) return cache.get(revid)!;
    const content = await client.getRevisionContent(revid);
    cache.set(revid, content);
    if (phase === "searching") {
      reads += 1;
      emit({ phase: "searching", read: reads, estimate });
    }
    return content;
  };
  read.prefetch = async (revids) => {
    const missing = revids.filter((r) => !cache.has(r));
    if (missing.length === 0) return;
    const batch = await client.getContentBatch(missing);
    for (const r of missing) cache.set(r, batch.get(r) ?? null);
  };

  emit({ phase: "listing" });
  const { revisions, truncated } = await client.listRevisions(input.article);

  stage("listing");
  if (revisions.length === 0)
    throw new ClaimNotFoundError(input.article, input.phrase);
  estimate = Math.max(6, Math.ceil(Math.log2(revisions.length + 1)) * 2);
  emit({ phase: "listed", revisions: revisions.length, truncated });

  const intro = await findIntroduction(
    revisions,
    input.phrase,
    read,
    (probe) => {
      probes.push(probe);
      emit({ phase: "searching", read: reads, estimate, probe });
    },
  );
  stage("search");
  if (intro === null) throw new ClaimNotFoundError(input.article, input.phrase);

  const originProven = intro.earliestProven && !truncated;
  emit({
    phase: "located",
    year: year(intro.revision.timestamp),
    removed: intro.removedSince,
  });

  phase = "reading";
  emit({ phase: "reading" });
  const latest = revisions[revisions.length - 1];
  const [introContent, latestContent] = await Promise.all([
    read(intro.revision.revid).then((c) => c ?? ""),
    read(latest.revid).then((c) => c ?? ""),
  ]);
  emit({ phase: "detecting" });

  const introRef = detectRefNear(introContent, input.phrase);
  const currentRef = intro.removedSince
    ? { sourced: false, source: null, refText: null, note: false }
    : detectRefNear(latestContent, input.phrase);

  const bornSourced = introRef.sourced;
  const nowSourced = currentRef.sourced;

  const bornAtLatest = intro.index === revisions.length - 1;
  const bornAtOldest = intro.index === 0;

  const bornNoteOnly = !bornSourced && introRef.note;
  const nowNoteOnly = !nowSourced && currentRef.note;

  const introYear = Number(year(intro.revision.timestamp));
  const lexicalPrimary: Verdict = bornSourced
    ? nowSourced
      ? "born-sourced"
      : "source-lost"
    : nowSourced
      ? "retrofit"
      : "unsourced-stable";

  stage("read");
  emit({ phase: "genealogy", hop: 0 });
  const genealogy = await reconstructGenealogy({
    article: input.article,
    phrase: input.phrase,
    lang,
    maxPages: input.maxPages,
    fetchJson: input.fetchJson,
    cache: input.cache,
    revisions,
    read,
    onHop: (hop) => emit({ phase: "genealogy", hop }),
  }).catch(() => null);
  stage("genealogy");

  const chainOldToNew: GenealogyHop[] = genealogy
    ? [...genealogy.chain].reverse()
    : [];
  const originHop = chainOldToNew[0] ?? null;
  const moved = (genealogy?.movedEarlier ?? false) && originHop != null;

  const effectiveBornSourced = moved ? originHop!.sourced : bornSourced;
  const effectiveIntroYear = moved
    ? Number(originHop!.date.slice(0, 4))
    : introYear;
  const effectiveIntroSource = moved ? originHop!.source : introRef.source;

  const genealogyPrimary: Verdict = effectiveBornSourced
    ? nowSourced
      ? "born-sourced"
      : "source-lost"
    : nowSourced
      ? "retrofit"
      : "unsourced-stable";

  const removed = intro.removedSince;

  const corrected = !removed && moved && genealogyPrimary !== lexicalPrimary;
  const primary: Verdict = removed
    ? "removed"
    : corrected
      ? "ambiguous"
      : moved
        ? genealogyPrimary
        : lexicalPrimary;
  const narrativePrimary: Verdict = moved ? genealogyPrimary : lexicalPrimary;

  const abstained =
    genealogy?.terminus === "broke:low-overlap" ||
    genealogy?.terminus === "broke:no-anchor-reword";

  const isRetrofit = !effectiveBornSourced && nowSourced && !intro.removedSince;
  const circularLoop =
    isRetrofit &&
    currentRef.source?.year !== undefined &&
    Number.isFinite(effectiveIntroYear) &&
    currentRef.source.year > effectiveIntroYear
      ? citogenesisLoop(
          currentRef.source,
          effectiveIntroYear,
          year(latest.timestamp),
        )
      : null;

  const absentNote = originProven
    ? "the claim does not exist in the article yet"
    : "not present in the revision just before this one — an earlier sparse occurrence below the searched range isn't ruled out";

  let timeline: TimelineEvent[];
  if (moved) {
    timeline = chainTimeline(
      chainOldToNew,
      revisions,
      latest,
      latestContent,
      currentRef.source,
      currentRef.sourced,
      intro.removedSince,
      input.phrase,
      abstained,
      absentNote,
    );
  } else {
    timeline = [];
    if (intro.priorRevision) {
      timeline.push({
        id: "e0",
        date: year(intro.priorRevision.timestamp),
        kind: "claim-absent",
        note: absentNote,
      });
    }
    timeline.push({
      id: "e1",
      date: yearMonth(intro.revision.timestamp),
      kind: "claim-introduced",
      wording: excerpt(introContent, input.phrase),
      source: introRef.source,
      ...(bornSourced && introRef.source == null ? { refUnparsed: true } : {}),
      revId: intro.revision.revid,
      ...(bornNoteOnly ? { hasExplanatoryNote: true } : {}),
      ...(abstained
        ? {
            note: "an earlier wording likely exists but couldn't be confirmed (low lexical overlap)",
          }
        : {}),
    });
    if (intro.removedSince) {
      timeline.push({
        id: "e2",
        date: "?",
        kind: "removed",
        note: "no longer in the current revision (removal revision not located in this pass)",
      });
    } else if (!bornAtLatest) {
      const evidenceChanged = nowSourced && !bornSourced;
      timeline.push({
        id: "e2",
        date: yearMonth(latest.timestamp),
        kind: nowSourced && !bornSourced ? "source-added" : "current",
        wording: excerpt(latestContent, input.phrase),
        source: currentRef.source,
        ...(nowSourced && currentRef.source == null
          ? { refUnparsed: true }
          : {}),
        revId: latest.revid,
        ...(nowNoteOnly ? { hasExplanatoryNote: true } : {}),
        ...(evidenceChanged
          ? {
              transition: {
                changes: ["evidence-added"],
                magnitude: "major",
                note: "citation attached after introduction",
              } as const,
            }
          : {}),
      });
    }
  }

  const readings: VerdictReading[] | undefined = corrected
    ? [
        {
          lens: "by current wording",
          verdict: lexicalPrimary,
          reason: readingReason(
            lexicalPrimary,
            introYear,
            currentRef.source?.label ?? null,
          ),
        },
        {
          lens: "by idea genealogy",
          verdict: genealogyPrimary,
          reason: genealogyReason(
            genealogyPrimary,
            effectiveIntroYear,
            chainOldToNew.length - 1,
            currentRef.source?.label ?? null,
          ),
        },
      ]
    : undefined;

  const confidence = verdictConfidence({
    corrected,
    abstained,
    bornAtOldest,
    removedSince: intro.removedSince,
    earliestUnproven: !intro.earliestProven,
    origin: genealogy
      ? {
          reach: residualShape(genealogy.terminus),
          bulkInsertion: genealogy.terminus === "origin:bulk-insertion",
          nonMonotonic: genealogy.nonMonotonic,
        }
      : null,
  });

  const search: SearchTrace = {
    corpusSize: revisions.length,
    reads: intro.contentFetches,
    probes,
    originIndex: intro.index,
    originRevId: intro.revision.revid,
    originProven,
    span: { from: year(revisions[0].timestamp), to: year(latest.timestamp) },
  };

  const provenance: ClaimProvenance = {
    claim: {
      text: input.claimText ?? input.phrase,
      article: input.article,
      articleUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
        input.article.replace(/ /g, "_"),
      )}`,
      lang,
    },
    verdict: {
      primary,
      confidence: confidence.level,
      ...(confidence.reasons.length
        ? { confidenceReasons: confidence.reasons }
        : {}),
      summary: corrected
        ? correctedSummary(lexicalPrimary, genealogyPrimary, effectiveIntroYear)
        : summarize(narrativePrimary, intro.removedSince, circularLoop != null),
      ...(readings ? { readings } : {}),
    },
    timeline,
    search,
    ...(circularLoop ? { annotations: { circularLoop } } : {}),
    credibilityRead: credibilityRead(narrativePrimary, {
      introRef: effectiveIntroSource,
      currentRef: currentRef.source,
      removedSince: intro.removedSince,
      noteOnly: nowNoteOnly || bornNoteOnly,
      circular: circularLoop != null,
    }),
    ...sourceQualityFor(effectiveIntroSource, currentRef.source),
    meta: {
      generatedBy: "wikiblame-pipeline",
      fetchedAt: new Date().toISOString(),
      corpus: {
        read: cache.size,
        total: revisions.length,
        truncated,
        originProven,
      },
      ...(() => {
        const notes = buildNotes(intro);
        return notes ? { notes } : {};
      })(),
    },
  };
  stage("assemble");
  return provenance;
}

const VERDICT_PHRASE: Record<Verdict, string> = {
  "born-sourced": "born-sourced",
  retrofit: "a retrofit (born unsourced)",
  "source-lost": "born-sourced but since stripped of its source",
  "unsourced-stable": "unsourced",
  ambiguous: "ambiguous",
  removed: "removed",
};

function clip(s: string): string {
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

function chainTimeline(
  oldToNew: GenealogyHop[],
  revisions: RevisionMeta[],
  latest: RevisionMeta,
  latestContent: string,
  currentSource: ClaimSource | null,
  currentSourced: boolean,
  removedSince: boolean,
  phrase: string,
  abstained: boolean,
  absentNote: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const origin = oldToNew[0];

  const originIdx = revisions.findIndex((r) => r.revid === origin.revId);
  if (originIdx > 0) {
    events.push({
      id: "e-absent",
      date: year(revisions[originIdx - 1].timestamp),
      kind: "claim-absent",
      note: absentNote,
    });
  }

  oldToNew.forEach((hop, i) => {
    if (i === 0) {
      events.push({
        id: `g${i}`,
        date: hop.date,
        kind: "claim-introduced",
        wording: clip(hop.wording),
        source: hop.source,
        ...(hop.sourced && hop.source == null ? { refUnparsed: true } : {}),
        revId: hop.revId,
        ...(abstained
          ? {
              note: "an earlier wording likely exists but couldn't be confirmed (low lexical overlap)",
            }
          : {}),
      });
      return;
    }
    const prev = oldToNew[i - 1];

    const gained = !prev.sourced && hop.sourced && hop.source != null;

    const swapped =
      prev.sourced &&
      hop.sourced &&
      hop.source != null &&
      prev.sourceLabel !== hop.sourceLabel;

    const kind: EventKind = gained
      ? "source-added"
      : swapped
        ? "source-replaced"
        : "reworded";

    const changes: ChangeTag[] = gained
      ? ["reworded", "evidence-added"]
      : swapped
        ? ["reworded", "evidence-swapped"]
        : ["reworded"];
    events.push({
      id: `g${i}`,
      date: hop.date,
      kind,
      wording: clip(hop.wording),
      source: hop.source,
      ...(hop.sourced && hop.source == null ? { refUnparsed: true } : {}),
      revId: hop.revId,
      transition: {
        changes,
        magnitude: kind === "reworded" ? "minor" : "major",
        ...(gained
          ? { note: "citation attached at this rewording" }
          : swapped
            ? { note: "citation swapped at this rewording" }
            : {}),
      },
    });
  });

  const lexIntro = oldToNew[oldToNew.length - 1];
  if (removedSince) {
    events.push({
      id: "e-current",
      date: "?",
      kind: "removed",
      note: "no longer in the current revision (removal revision not located in this pass)",
    });
  } else if (latest.revid !== lexIntro.revId) {
    events.push({
      id: "e-current",
      date: yearMonth(latest.timestamp),
      kind: "current",
      wording: excerpt(latestContent, phrase),
      source: currentSource,
      ...(currentSourced && currentSource == null ? { refUnparsed: true } : {}),
      revId: latest.revid,
    });
  }

  return events;
}

function readingReason(
  v: Verdict,
  introYear: number,
  currentLabel: string | null,
): string {
  if (v === "born-sourced")
    return `The current wording first appears in ${introYear}, cited from the start.`;
  if (v === "retrofit")
    return `The current wording first appears in ${introYear} unsourced; the citation${currentLabel ? ` (${currentLabel})` : ""} attached later.`;
  if (v === "source-lost")
    return `The current wording first appears in ${introYear} cited, but the citation was later removed — it now stands uncited.`;
  return `The current wording first appears in ${introYear} and is still uncited.`;
}

function genealogyReason(
  v: Verdict,
  originYear: number,
  rewordings: number,
  currentLabel: string | null,
): string {
  const via =
    rewordings > 0
      ? ` through ${rewordings} rewording${rewordings > 1 ? "s" : ""}`
      : "";
  if (v === "born-sourced")
    return `The idea traces back to ${originYear}${via}, cited then too.`;
  if (v === "retrofit")
    return `The idea traces back to ${originYear}${via}, where it stood uncited — the citation${currentLabel ? ` (${currentLabel})` : ""} is retroactive.`;
  if (v === "source-lost")
    return `The idea traces back to ${originYear}${via}, cited then; the citation was later stripped, so it now stands uncited.`;
  return `The idea traces back to ${originYear}${via}, where it stood uncited.`;
}

function correctedSummary(
  lexical: Verdict,
  genealogy: Verdict,
  originYear: number,
): string {
  return `Reads ${VERDICT_PHRASE[lexical]} by the current wording, but the idea traces back to ${originYear} — ${VERDICT_PHRASE[genealogy]}. The two readings disagree; both are shown.`;
}

function citogenesisLoop(
  source: ClaimSource,
  introYear: number,
  currentYear: string,
): NonNullable<ClaimProvenance["annotations"]>["circularLoop"] {
  const citedYear = Number(currentYear);
  return {
    cycle: [
      {
        actor: "Wikipedia",
        year: introYear,
        action: "asserts the claim, unsourced",
      },
      {
        actor: source.label,
        year: source.year!,
        action: "publishes it — after Wikipedia",
      },
      {
        actor: "Wikipedia",
        year: Number.isFinite(citedYear) ? citedYear : source.year!,
        action: `cites ${source.label} as backing`,
      },
    ],
    note: `The cited source (${source.label}, ${source.year}) postdates the claim's unsourced appearance on Wikipedia (${introYear}). A source published after the claim was already here cannot be its origin — the backing may be circular. The exact revision that attached the citation isn't pinned in this pass.`,
  };
}

function summarize(
  primary: Verdict,
  removed: boolean,
  circular: boolean,
): string {
  if (removed)
    return "The claim existed and was later removed from the article.";
  switch (primary) {
    case "born-sourced":
      return "Claim and citation entered together at introduction.";
    case "retrofit":
      return circular
        ? "Born unsourced; the citation attached later was published after the claim — the backing may be circular."
        : "Born unsourced; the citation was attached later.";
    case "source-lost":
      return "Born with a citation that was later removed; the claim now stands unsourced.";
    case "unsourced-stable":
      return "Never sourced, but never removed.";
    default:
      return "";
  }
}

function credibilityRead(
  primary: Verdict,
  ctx: {
    introRef: { label: string } | null;
    currentRef: { label: string } | null;
    removedSince: boolean;
    noteOnly: boolean;
    circular: boolean;
  },
): string {
  if (ctx.removedSince) {
    return "The claim was introduced and later removed from the article. The window in which it was present is traced down to the introduction revision.";
  }
  switch (primary) {
    case "born-sourced":
      return `Born with a source (${ctx.introRef?.label ?? "citation"}) in the same revision that introduced the claim — the backing precedes or accompanies the assertion.`;
    case "retrofit":
      return ctx.circular
        ? `Presented as fact with no source at introduction; the citation that later stuck (${ctx.currentRef?.label ?? "current"}) was published after the claim already lived here, so it cannot be the origin — the backing may trace back to this article itself.`
        : `Presented as fact with no source at introduction; the citation (${ctx.currentRef?.label ?? "current"}) only stuck on later. The backing is retroactive.`;
    case "source-lost":
      return `Born with a source (${ctx.introRef?.label ?? "citation"}) at introduction, but the citation was later removed — the claim now stands unsourced in the current revision. Its backing was there and is gone.`;
    case "unsourced-stable":
      return ctx.noteOnly
        ? "Introduced unsourced and still unsourced. It carries an explanatory footnote — the “[α]”-style marker that reads like a reference — but that note only adds context; it cites no source."
        : "Introduced unsourced and still unsourced in the current revision — never backed, never removed.";
    default:
      return "";
  }
}

function sourceQualityFor(
  a: { type: string } | null,
  b: { type: string } | null,
): Pick<ClaimProvenance, "sourceQuality"> {
  const types = [a?.type, b?.type].filter(Boolean) as string[];
  if (types.length === 0) return {};
  const hasPrimary = types.some((t) => t === "peer-reviewed");
  if (hasPrimary) return {};
  return {
    sourceQuality: {
      note: "no primary or peer-reviewed source detected in this pass",
      flags: ["no-primary-source"],
    },
  };
}

function buildNotes(intro: {
  assumptionViolated: boolean;
}): string | undefined {
  if (!intro.assumptionViolated) return undefined;
  return "non-monotonic presence at the boundary — the window may not be the first occurrence; verify.";
}

function year(timestamp: string): string {
  return timestamp.slice(0, 4) || "?";
}

function yearMonth(timestamp: string): string {
  return timestamp.slice(0, 7) || "?";
}

function excerpt(content: string, phrase: string): string {
  const target = normalize(phrase);
  if (target) {
    for (const raw of sentences(content)) {
      const clean = cleanProse(raw);
      if (normalize(clean).includes(target)) return clip(clean);
    }
  }

  const clean = content
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ");

  const idx = anchorIndex(clean, phrase);
  if (idx < 0) return clip(cleanProse(phrase));

  const start = clean.lastIndexOf(".", idx);
  const end = clean.indexOf(".", idx);
  const sentence = clean.slice(start + 1, end < 0 ? idx + 120 : end).trim();
  return clip(sentence);
}
