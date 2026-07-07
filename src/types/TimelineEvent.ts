import type { ClaimSource } from "./ClaimSource";
import type { EventKind } from "./EventKind";
import type { Transition } from "./Transition";

export interface TimelineEvent {
  id: string;
  date: string;
  kind: EventKind;
  wording?: string;
  source?: ClaimSource | null;
  hasExplanatoryNote?: boolean;
  revId?: number;
  note?: string;
  transition?: Transition;
}
