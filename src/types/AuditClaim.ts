import type { ClaimSource } from "./ClaimSource";
import type { SentenceStatus } from "./SentenceStatus";

export interface AuditClaim {
  id: string;
  text: string;
  status: SentenceStatus;
  source?: ClaimSource | null;
  /** A <ref> was detected on this claim but couldn't be parsed into an
   *  attributable source (bare URL, unknown template, reuse pointer). The claim
   *  IS cited — we just have nothing structured to render — so this must NOT
   *  read as "no source". Mirrors `refUnparsed` on TimelineEvent. */
  refUnparsed?: boolean;
}
