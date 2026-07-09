import type { Confidence } from "@/types/Confidence";

// How far the genealogy pass got toward the claim's real origin, already reduced
// from the raw terminus by residualShape() in genealogy.ts:
//   resolved         — reached a real prose birth (fresh-insertion / first-rev / bulk)
//   more-determinism — broke, but on a recoverable seam (structured genesis, merge)
//   semantic         — broke needing a judgment we won't make (reword, low overlap)
//   unrecoverable    — the claim carries no stable anchor to trace on
export type OriginReach =
  | "resolved"
  | "more-determinism"
  | "semantic"
  | "unrecoverable";

export interface ConfidenceSignals {
  /** The two lenses disagree and we present both — no single-story verdict. */
  corrected: boolean;
  /** A probable earlier reword exists but couldn't be confirmed (abstained). */
  abstained: boolean;
  /** The introduction is the oldest revision we fetched — maybe a window artifact. */
  bornAtLatest: boolean;
  /** The claim left the article but the removal revision wasn't located. */
  removedSince: boolean;
  /** Genealogy outcome, or null when that pass failed and we fell back to the
   *  pure lexical born/now trace with no lineage corroboration. */
  origin: {
    reach: OriginReach;
    /** Origin is a large batch paste — found, but could originate elsewhere. */
    bulkInsertion: boolean;
    /** A hop crossed a non-monotonic boundary — chain is suggestive, not proven. */
    nonMonotonic: boolean;
  } | null;
}

export interface ConfidenceResult {
  level: Confidence;
  /** The specific uncertainties that docked the level, newest concern first.
   *  Empty when nothing undermined the trace (i.e. `high`). */
  reasons: string[];
}

// Terse caveat copy, one per downgrade signal. Lowercase fragments so they read
// as a list of annotations under the verdict.
const REASONS = {
  corrected: "the two readings disagree — no single verdict is asserted",
  lexicalOnly: "no lineage was reconstructed — this rests on the lexical trace alone",
  bornAtLatest:
    "the claim already exists in the oldest revision fetched, so its birth may predate the trace",
  bulkInsertion:
    "the origin is a large batch edit — the idea may have been pasted in from elsewhere",
  moreDeterminism:
    "the lineage broke on a structural seam (infobox, table, or a cross-article merge)",
  semantic: "the lineage broke on a reword that couldn't be confirmed without judgment",
  unrecoverable: "the claim carries no stable anchor to trace its history on",
  nonMonotonic: "part of the chain crosses a non-monotonic edit — it's suggestive, not proven",
  abstained: "a probable earlier wording exists but couldn't be verified",
  removedSince: "the removal revision wasn't located, so the timeline is incomplete",
} as const;

// Deterministic, no NLP: start at "high" and dock a level per named uncertainty
// in the trace. Every downgrade traces to one signal, so the label is auditable
// — and each signal carries the sentence that explains it.
//   0 penalties → high · 1 → medium · ≥2 → low
export function verdictConfidence(s: ConfidenceSignals): ConfidenceResult {
  // Dual readings are definitionally two-sided; don't assert single-story confidence.
  if (s.corrected) return { level: "low", reasons: [REASONS.corrected] };

  let penalty = 0;
  const reasons: string[] = [];
  const dock = (n: number, reason: string) => {
    penalty += n;
    reasons.push(reason);
  };

  if (s.origin == null) {
    // Pure lexical fallback — no lineage evidence for where the claim was born.
    dock(1, REASONS.lexicalOnly);
    // ...and if the intro is the oldest revision we saw, we may not have reached
    // the birth at all — only that it predates our window.
    if (s.bornAtLatest) dock(1, REASONS.bornAtLatest);
  } else {
    switch (s.origin.reach) {
      case "resolved":
        // fresh-insertion / first-revision are clean; a bulk paste is not.
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

  // Stacks with a "semantic" reach: the shakiest breaks (low-overlap /
  // no-anchor-reword) are exactly the abstained ones, so they land at low.
  if (s.abstained) dock(1, REASONS.abstained);
  if (s.removedSince) dock(1, REASONS.removedSince);

  const level: Confidence = penalty <= 0 ? "high" : penalty === 1 ? "medium" : "low";
  return { level, reasons };
}
