import type { ArticleAudit } from "../types/ArticleAudit.ts";
import type { ClaimProvenance } from "../types/ClaimProvenance.ts";

// A curated, reproducible case. The verdict is never hand-authored — it is a
// pinned snapshot of the real engine run against a seed, so every investigation
// can be re-traced live from the same article + phrase.

export type PhenomenonId =
  | "citogenesis"
  | "retrofit"
  | "churn"
  | "unsourced-stable"
  | "contested"
  | "ambiguous"
  | "note-not-source"
  | "born-sourced"
  | "coverage";

export interface TraceSeed {
  kind: "trace";
  article: string;
  phrase: string;
  /** Optional display text for the claim header, when the search phrase is terse. */
  claimText?: string;
  lang?: string;
}

export interface AuditSeed {
  kind: "audit";
  article: string;
  lang?: string;
}

export type Seed = TraceSeed | AuditSeed;

/** The editorial half — hand-curated, committed by a human. */
export interface InvestigationSeed {
  slug: string;
  /** Editorial headline, e.g. "The Brazilian aardvark". */
  title: string;
  /** One-line hook shown on the card. */
  dek: string;
  /** Which capability this case is here to demonstrate. */
  phenomenon: PhenomenonId;
  /** Why it matters — 2-3 sentences of context the engine can't narrate. */
  narrative: string;
  seed: Seed;
}

/** The engine half — a pinned snapshot, produced by the generator. */
export interface Snapshot {
  pinnedAt: string;
  data: ClaimProvenance | ArticleAudit;
}

/** A fully-resolved investigation: editorial + pinned engine output. */
export interface Investigation extends InvestigationSeed, Snapshot {}
