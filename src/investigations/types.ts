import type { ArticleAudit } from "../types/ArticleAudit.ts";
import type { ClaimProvenance } from "../types/ClaimProvenance.ts";


export type PhenomenonId =
  | "citogenesis"
  | "retrofit"
  | "unsourced-stable"
  | "ambiguous"
  | "note-not-source"
  | "born-sourced"
  | "coverage";

export interface TraceSeed {
  kind: "trace";
  article: string;
  phrase: string;
  claimText?: string;
  lang?: string;
}

export interface AuditSeed {
  kind: "audit";
  article: string;
  lang?: string;
}

export type Seed = TraceSeed | AuditSeed;

export interface InvestigationSeed {
  slug: string;
  title: string;
  dek: string;
  phenomenon: PhenomenonId;
  narrative: string;
  seed: Seed;
}

export interface Snapshot {
  pinnedAt: string;
  data: ClaimProvenance | ArticleAudit;
}

export interface Investigation extends InvestigationSeed, Snapshot {}
