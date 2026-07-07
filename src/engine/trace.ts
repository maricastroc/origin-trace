/**
 * The orchestrator — the seam the whole project was built around.
 *
 * It composes the API client and the blame primitive into a ClaimProvenance,
 * the exact contract the UI already consumes from the hand-written mocks. The
 * only visible difference is `meta.generatedBy: "wikiblame-pipeline"`.
 *
 * It is deliberately conservative: the engine reports `confidence: "low"` and
 * spells out its assumptions in `meta.notes`, because a single-phrase trace with
 * heuristic <ref> detection is a first cut, not the manual traces' authority.
 */
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { TimelineEvent } from "@/types/TimelineEvent";
import type { Verdict } from "@/types/Verdict";
import {
  anchorIndex,
  detectRefNear,
  findIntroduction,
  type ContentReader,
} from "./blame.ts";
import { WikipediaClient, type FetchJson } from "./wikipedia.ts";

export interface TraceInput {
  /** Article title as it appears in the URL, e.g. "Quokka". */
  article: string;
  /** The claim phrase to locate in the revision history. */
  phrase: string;
  lang?: string;
  /** Display text for the claim; defaults to `phrase`. */
  claimText?: string;
  /** Cap on revision-list pages (see WikipediaClient). */
  maxPages?: number;
  /** Test seam: inject a recorded transport. */
  fetchJson?: FetchJson;
}

/** Thrown when the phrase is not found in any revision we read. */
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
  });

  // One cache shared by the whole trace — the binary search and the later
  // detail reads never fetch the same revision twice.
  const cache = new Map<number, string | null>();
  const read: ContentReader = async (revid) => {
    if (cache.has(revid)) return cache.get(revid)!;
    const content = await client.getRevisionContent(revid);
    cache.set(revid, content);
    return content;
  };

  const { revisions, truncated } = await client.listRevisions(input.article);
  if (revisions.length === 0) throw new ClaimNotFoundError(input.article, input.phrase);

  const intro = await findIntroduction(revisions, input.phrase, read);
  if (intro === null) throw new ClaimNotFoundError(input.article, input.phrase);

  const latest = revisions[revisions.length - 1];
  const introContent = (await read(intro.revision.revid)) ?? "";
  const latestContent = (await read(latest.revid)) ?? "";

  const introRef = detectRefNear(introContent, input.phrase);
  const currentRef = intro.removedSince
    ? { sourced: false, source: null, refText: null }
    : detectRefNear(latestContent, input.phrase);

  const bornSourced = introRef.sourced;
  const nowSourced = currentRef.sourced;
  const bornAtLatest = intro.index === revisions.length - 1;

  const primary: Verdict = bornSourced
    ? "born-sourced"
    : nowSourced
      ? "retrofit"
      : "unsourced-stable";

  // --- Timeline ---
  const timeline: TimelineEvent[] = [];

  if (intro.priorRevision) {
    timeline.push({
      id: "e0",
      date: year(intro.priorRevision.timestamp),
      kind: "claim-absent",
      note: "a afirmação ainda não existe no artigo",
    });
  }

  timeline.push({
    id: "e1",
    date: yearMonth(intro.revision.timestamp),
    kind: "claim-introduced",
    wording: excerpt(introContent, input.phrase),
    source: introRef.source, // null ⇒ provably unsourced at birth
    revId: intro.revision.revid,
  });

  if (intro.removedSince) {
    timeline.push({
      id: "e2",
      date: "?",
      kind: "removed",
      note: "não está mais na revisão atual (revisão de remoção não localizada nesta passagem)",
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
      ...(evidenceChanged
        ? {
            transition: {
              changes: ["evidence-changed"],
              magnitude: "major",
              note: "citação anexada depois da introdução",
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
      summary: summarize(primary, intro.removedSince),
    },
    timeline,
    credibilityRead: credibilityRead(primary, {
      introRef: introRef.source,
      currentRef: currentRef.source,
      removedSince: intro.removedSince,
    }),
    ...sourceQualityFor(introRef.source, currentRef.source),
    meta: {
      generatedBy: "wikiblame-pipeline",
      fetchedAt: new Date().toISOString(),
      notes: buildNotes(intro, revisions.length, truncated),
    },
  };
}

// --- Prose (Portuguese, matching the hand-written mocks' voice) -------------

function summarize(primary: Verdict, removed: boolean): string {
  if (removed) return "A afirmação existiu e depois foi removida do artigo.";
  switch (primary) {
    case "born-sourced":
      return "Afirmação e citação entraram juntas na introdução.";
    case "retrofit":
      return "Nasceu sem fonte; a citação foi anexada depois.";
    case "unsourced-stable":
      return "Nunca teve fonte, mas nunca foi removida.";
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
  },
): string {
  if (ctx.removedSince) {
    return "A afirmação foi introduzida e mais tarde removida do artigo. A janela em que esteve presente está rastreada até a revisão de introdução.";
  }
  switch (primary) {
    case "born-sourced":
      return `Nasceu com fonte (${ctx.introRef?.label ?? "citação"}) na mesma revisão que introduziu a afirmação — o respaldo precede ou acompanha a alegação.`;
    case "retrofit":
      return `Foi apresentada como fato sem nenhuma fonte na introdução; a citação (${ctx.currentRef?.label ?? "atual"}) só grudou depois. O respaldo é retroativo.`;
    case "unsourced-stable":
      return "Foi introduzida sem fonte e permanece sem fonte na revisão atual — nunca respaldada, nunca removida.";
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
      note: "nenhuma fonte primária ou revisada por pares detectada nesta passagem",
      flags: ["no-primary-source"],
    },
  };
}

function buildNotes(
  intro: { contentFetches: number; assumptionViolated: boolean },
  total: number,
  truncated: boolean,
): string {
  const parts = [
    `${intro.contentFetches} de ${total} revisões lidas (introdução por busca binária)`,
  ];
  if (intro.assumptionViolated) {
    parts.push(
      "presença não-monotônica no limite — a janela pode não ser a primeira ocorrência; verificar",
    );
  }
  if (truncated) {
    parts.push("histórico truncado por maxPages — closure do corpus não provada");
  }
  return parts.join("; ") + ".";
}

// --- Small text helpers -----------------------------------------------------

function year(timestamp: string): string {
  return timestamp.slice(0, 4) || "?";
}

function yearMonth(timestamp: string): string {
  return timestamp.slice(0, 7) || "?";
}

/**
 * Pull the human-readable wording around the phrase at a given revision — this
 * is how the UI shows that "frases mudam". Cleans wiki markup, keeps case and
 * light punctuation, trims to a sentence-ish window.
 */
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
