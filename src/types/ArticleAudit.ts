import type { ClaimSource } from "./ClaimSource";

/**
 * The article-audit contract — the "sourced map" of a whole article.
 *
 * Where ClaimProvenance answers "what is the evidence history of THIS claim,"
 * ArticleAudit answers the cheap, structural question "which sentences in this
 * article carry an inline citation, and which assert without one." It is a
 * single-fetch, deterministic read of the *current* revision — no history walk.
 * Per-claim history (retrofit/churn) is the expensive tier, run on demand by
 * feeding a flagged sentence's text back into the trace pipeline.
 */

/**
 * A sentence's citation state, read purely from the markup:
 *  - `sourced`    — a real <ref>/{{cite}} sits on the sentence.
 *  - `note-only`  — only an explanatory footnote ({{efn}} / grouped <ref>) is
 *                   attached; it reads like a reference but cites nothing.
 *  - `unsourced`  — no inline citation on the sentence. Descriptive, not a
 *                   verdict: many sentences legitimately need none (see notes).
 */
export type SentenceStatus = "sourced" | "note-only" | "unsourced";

export interface AuditClaim {
  id: string;
  /** Cleaned display prose (wiki markup and refs stripped). */
  text: string;
  status: SentenceStatus;
  /** Present when status === "sourced". */
  source?: ClaimSource | null;
}

export interface AuditSection {
  /** Section heading; empty string for the lead. */
  heading: string;
  /** Heading depth (2 for `==`…). 0 for the lead. */
  level: number;
  /**
   * The lead is audited but reported apart: per WP:LEADCITE the intro summarizes
   * claims cited in the body, so an uncited lead sentence is not, by itself, a gap.
   */
  isLead: boolean;
  claims: AuditClaim[];
}

/** Counts over one band of the article (the body, or the lead). */
export interface AuditTally {
  total: number;
  sourced: number;
  noteOnly: number;
  unsourced: number;
}

export interface AuditSummary {
  /** The body — everything below the lead. Coverage is measured here. */
  body: AuditTally;
  /** The lead, counted separately (not folded into the coverage gap). */
  lead: AuditTally;
  /** sourced / total across the body, 0..1. 1 when the body has no sentences. */
  coverage: number;
}

export interface ArticleAudit {
  article: {
    title: string;
    url: string;
    lang: string;
    /** The revision this audit read. */
    revId: number;
  };
  sections: AuditSection[];
  summary: AuditSummary;
  meta: {
    generatedBy: "wikiblame-audit";
    fetchedAt: string;
    /** The heuristic caveat — segmentation is structural, not perfect. */
    notes: string;
  };
}
