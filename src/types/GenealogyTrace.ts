/**
 * The reformulation chain the genealogy walk reconstructed — one wording per
 * revision it stepped through, oldest → newest, with the anchors (numbers,
 * proper names) that carried from each wording into the next. This is the
 * LCS-diff work made legible: the *string* drifts, but the *idea* persists in
 * its anchors, which is what let the trace follow it back past a rewording.
 *
 * Deterministic, like everything else on the case file — a pure function of the
 * revision history. Present only when the wording actually drifted (≥2 steps);
 * a claim whose string never changed has no chain to show.
 */

export interface GenealogyStep {
  /** The claim's wording at this revision. */
  wording: string;
  /** Year-month of the revision. */
  date: string;
  revId: number;
  /** Was a real citation on the claim's own sentence at this step? */
  sourced: boolean;
  sourceLabel: string | null;
  /** Anchors this wording shares with the PREVIOUS (older) step — the invariant
   *  the walk followed across the rewording. Empty on the origin (nothing
   *  before it). */
  anchorsShared: string[];
  /** Content-word overlap with the previous step (0..1). Absent on the origin. */
  overlap?: number;
}

export interface GenealogyTrace {
  /** Oldest → newest. First is the reconstructed origin; last is the current
   *  (lexical) wording. */
  steps: GenealogyStep[];
  /** Where the walk stopped — the raw {@link Terminus} tag from the engine. */
  terminus: string;
  /** The residual shape of that terminus: whether the walk resolved cleanly,
   *  could go deeper with more determinism, hit a semantic wall, or ran out of
   *  anchors. */
  residual: "resolved" | "more-determinism" | "semantic" | "unrecoverable";
  /** True when the idea reached earlier than the lexical (current-wording)
   *  origin — i.e. following the anchors moved the origin back. */
  movedEarlier: boolean;
  /** True when the claim's presence was non-monotonic somewhere on the walk. */
  nonMonotonic: boolean;
}
