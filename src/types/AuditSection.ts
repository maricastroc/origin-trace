import type { AuditClaim } from "./AuditClaim";

export interface AuditSection {
  heading: string;
  level: number;
  isLead: boolean;
  claims: AuditClaim[];
}
