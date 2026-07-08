import type { ClaimSource } from "./ClaimSource";
import type { EventKind } from "./EventKind";
import type { Transition } from "./Transition";

export interface TimelineEvent {
  id: string;
  date: string;
  kind: EventKind;
  wording?: string;
  source?: ClaimSource | null;
  /** A <ref> was detected here but couldn't be parsed into an attributable source
   *  (bare URL, unknown template, reuse pointer). The claim IS cited — we just have
   *  nothing structured to render — so this must NOT read as "no source". */
  refUnparsed?: boolean;
  hasExplanatoryNote?: boolean;
  revId?: number;
  note?: string;
  transition?: Transition;
}
