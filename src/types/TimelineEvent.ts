import type { ClaimSource } from "./ClaimSource";
import type { EventKind } from "./EventKind";
import type { Transition } from "./Transition";

export interface TimelineEvent {
  id: string;
  /** Variable granularity: "2005" | "2016-07" | "2016-07-11". */
  date: string;
  kind: EventKind;
  /** The claim text at this point in time (rendered in the voice font). */
  wording?: string;
  /** `null` means explicitly, provably unsourced; `undefined` means not applicable. */
  source?: ClaimSource | null;
  /**
   * The claim is unsourced here, but carries an explanatory footnote (an "[α]"
   * {{efn}}/grouped-<ref> marker) that reads like a reference and cites nothing.
   */
  hasExplanatoryNote?: boolean;
  /** The Wikipedia revision id — the closed-corpus receipt. */
  revId?: number;
  note?: string;
  /** Omitted on the first event. */
  transition?: Transition;
}
