import type { AuditSection } from "./AuditSection";
import type { AuditSummary } from "./AuditSummary";

export type { SentenceStatus } from "./SentenceStatus";
export type { AuditClaim } from "./AuditClaim";
export type { AuditSection } from "./AuditSection";
export type { AuditTally } from "./AuditTally";
export type { AuditSummary } from "./AuditSummary";

export interface ArticleAudit {
  article: {
    title: string;
    url: string;
    lang: string;
    revId: number;
  };
  sections: AuditSection[];
  summary: AuditSummary;
  meta: {
    generatedBy: "wikiblame-audit";
    fetchedAt: string;
    notes: string;
  };
}
