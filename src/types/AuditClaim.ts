import type { ClaimSource } from "./ClaimSource";
import type { SentenceStatus } from "./SentenceStatus";

export interface AuditClaim {
  id: string;
  text: string;
  status: SentenceStatus;
  source?: ClaimSource | null;
}
