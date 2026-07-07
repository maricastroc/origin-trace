import type { AuditTally } from "./AuditTally";

export interface AuditSummary {
  body: AuditTally;
  lead: AuditTally;
  coverage: number;
}
