import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { ClaimSource } from "@/types/ClaimSource";
import type { TimelineEvent } from "@/types/TimelineEvent";
import type { Verdict } from "@/types/Verdict";
import {
  anchorIndex,
  detectRefNear,
  findIntroduction,
  type ContentReader,
} from "./blame.ts";
import { WikipediaClient, type FetchJson } from "./wikipedia.ts";
import type { EngineCache } from "./cache.ts";

export type TraceProgress =
  | { phase: "listing" }
  | { phase: "listed"; revisions: number; truncated: boolean }
  | { phase: "searching"; read: number; estimate: number }
  | { phase: "located"; year: string; removed: boolean }
  | { phase: "reading" }
  | { phase: "detecting" };

export interface TraceInput {
  article: string;
  phrase: string;
  lang?: string;
  claimText?: string;
  maxPages?: number;
  fetchJson?: FetchJson;
  cache?: EngineCache;
  onProgress?: (progress: TraceProgress) => void;
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
  let phase: "searching" | "reading" = "searching";
  let reads = 0;
  let estimate = 12;

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

  emit({ phase: "listing" });
  const { revisions, truncated } = await client.listRevisions(input.article);
  if (revisions.length === 0) throw new ClaimNotFoundError(input.article, input.phrase);
  estimate = Math.max(6, Math.ceil(Math.log2(revisions.length + 1)) * 2);
  emit({ phase: "listed", revisions: revisions.length, truncated });

  const intro = await findIntroduction(revisions, input.phrase, read);
  if (intro === null) throw new ClaimNotFoundError(input.article, input.phrase);
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

  const bornNoteOnly = !bornSourced && introRef.note;
  const nowNoteOnly = !nowSourced && currentRef.note;

  const primary: Verdict = bornSourced
    ? "born-sourced"
    : nowSourced
      ? "retrofit"
      : "unsourced-stable";

  const introYear = Number(year(intro.revision.timestamp));
  const circularLoop =
    primary === "retrofit" &&
    !intro.removedSince &&
    currentRef.source?.year !== undefined &&
    Number.isFinite(introYear) &&
    currentRef.source.year > introYear
      ? citogenesisLoop(currentRef.source, introYear, year(latest.timestamp))
      : null;

  const timeline: TimelineEvent[] = [];

  if (intro.priorRevision) {
    timeline.push({
      id: "e0",
      date: year(intro.priorRevision.timestamp),
      kind: "claim-absent",
      note: "the claim does not exist in the article yet",
    });
  }

  timeline.push({
    id: "e1",
    date: yearMonth(intro.revision.timestamp),
    kind: "claim-introduced",
    wording: excerpt(introContent, input.phrase),
    source: introRef.source,
    revId: intro.revision.revid,
    ...(bornNoteOnly ? { hasExplanatoryNote: true } : {}),
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
      revId: latest.revid,
      ...(nowNoteOnly ? { hasExplanatoryNote: true } : {}),
      ...(evidenceChanged
        ? {
            transition: {
              changes: ["evidence-changed"],
              magnitude: "major",
              note: "citation attached after introduction",
            } as const,
          }
        : {}),
    });
  }

  return {
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
      confidence: "low",
      summary: summarize(primary, intro.removedSince, circularLoop != null),
    },
    timeline,
    ...(circularLoop ? { annotations: { circularLoop } } : {}),
    credibilityRead: credibilityRead(primary, {
      introRef: introRef.source,
      currentRef: currentRef.source,
      removedSince: intro.removedSince,
      noteOnly: nowNoteOnly || bornNoteOnly,
      circular: circularLoop != null,
    }),
    ...sourceQualityFor(introRef.source, currentRef.source),
    meta: {
      generatedBy: "wikiblame-pipeline",
      fetchedAt: new Date().toISOString(),
      corpus: {
        read: intro.contentFetches,
        total: revisions.length,
        truncated,
      },
      ...(() => {
        const notes = buildNotes(intro);
        return notes ? { notes } : {};
      })(),
    },
  };
}

function citogenesisLoop(
  source: ClaimSource,
  introYear: number,
  currentYear: string,
): NonNullable<ClaimProvenance["annotations"]>["circularLoop"] {
  const citedYear = Number(currentYear);
  return {
    cycle: [
      { actor: "Wikipedia", year: introYear, action: "asserts the claim, unsourced" },
      { actor: source.label, year: source.year!, action: "publishes it — after Wikipedia" },
      {
        actor: "Wikipedia",
        year: Number.isFinite(citedYear) ? citedYear : source.year!,
        action: `cites ${source.label} as backing`,
      },
    ],
    note: `The cited source (${source.label}, ${source.year}) postdates the claim's unsourced appearance on Wikipedia (${introYear}). A source published after the claim was already here cannot be its origin — the backing may be circular. The exact revision that attached the citation isn't pinned in this pass.`,
  };
}

function summarize(primary: Verdict, removed: boolean, circular: boolean): string {
  if (removed) return "The claim existed and was later removed from the article.";
  switch (primary) {
    case "born-sourced":
      return "Claim and citation entered together at introduction.";
    case "retrofit":
      return circular
        ? "Born unsourced; the citation attached later was published after the claim — the backing may be circular."
        : "Born unsourced; the citation was attached later.";
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

function buildNotes(intro: { assumptionViolated: boolean }): string | undefined {
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
  const clean = content
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ");

  const idx = anchorIndex(clean, phrase);
  if (idx < 0) return phrase;

  const start = clean.lastIndexOf(".", idx);
  const end = clean.indexOf(".", idx);
  const sentence = clean.slice(start + 1, end < 0 ? idx + 120 : end).trim();
  return sentence.length > 160 ? sentence.slice(0, 157) + "…" : sentence;
}
