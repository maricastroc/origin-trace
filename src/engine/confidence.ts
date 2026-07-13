import type { Confidence } from "@/types/Confidence";

export type OriginReach =
  "resolved" | "more-determinism" | "semantic" | "unrecoverable";

export interface ConfidenceSignals {
  corrected: boolean;
  abstained: boolean;
  /** The lexical introduction sits at the oldest revision we fetched, so the
   *  claim's true birth may predate the trace window. */
  bornAtOldest: boolean;
  removedSince: boolean;
  /** The search sampled the revisions below the origin rather than reading them
   *  all, so a sparse earlier occurrence can't be ruled out — the exact first
   *  appearance isn't proven. Optional; absent means proven/not-applicable. */
  earliestUnproven?: boolean;
  origin: {
    reach: OriginReach;
    bulkInsertion: boolean;
    nonMonotonic: boolean;
  } | null;
}

export interface ConfidenceResult {
  level: Confidence;

  reasons: string[];
}

const REASONS = {
  corrected: "the two readings disagree — no single verdict is asserted",
  lexicalOnly:
    "no lineage was reconstructed — this rests on the lexical trace alone",
  bornAtOldest:
    "the claim already exists in the oldest revision fetched, so its birth may predate the trace",
  bulkInsertion:
    "the origin is a large batch edit — the idea may have been pasted in from elsewhere",
  moreDeterminism:
    "the lineage broke on a structural seam (infobox, table, or a cross-article merge)",
  semantic:
    "the lineage broke on a reword that couldn't be confirmed without judgment",
  unrecoverable: "the claim carries no stable anchor to trace its history on",
  nonMonotonic:
    "part of the chain crosses a non-monotonic edit — it's suggestive, not proven",
  abstained: "a probable earlier wording exists but couldn't be verified",
  removedSince:
    "the removal revision wasn't located, so the timeline is incomplete",
  earliestUnproven:
    "the revisions below the origin were sampled, not all read — a sparse earlier occurrence can't be ruled out, so the exact first appearance isn't proven",
} as const;

export function verdictConfidence(s: ConfidenceSignals): ConfidenceResult {
  if (s.corrected) return { level: "low", reasons: [REASONS.corrected] };

  let penalty = 0;
  const reasons: string[] = [];
  const dock = (n: number, reason: string) => {
    penalty += n;
    reasons.push(reason);
  };

  if (s.origin == null) {
    dock(1, REASONS.lexicalOnly);

    if (s.bornAtOldest) dock(1, REASONS.bornAtOldest);
  } else {
    switch (s.origin.reach) {
      case "resolved":
        if (s.origin.bulkInsertion) dock(1, REASONS.bulkInsertion);
        break;
      case "more-determinism":
        dock(1, REASONS.moreDeterminism);
        break;
      case "semantic":
        dock(1, REASONS.semantic);
        break;
      case "unrecoverable":
        dock(2, REASONS.unrecoverable);
        break;
    }
    if (s.origin.nonMonotonic) dock(1, REASONS.nonMonotonic);
  }

  if (s.abstained) dock(1, REASONS.abstained);
  if (s.removedSince) dock(1, REASONS.removedSince);
  if (s.earliestUnproven) dock(1, REASONS.earliestUnproven);

  const level: Confidence =
    penalty <= 0 ? "high" : penalty === 1 ? "medium" : "low";
  return { level, reasons };
}
