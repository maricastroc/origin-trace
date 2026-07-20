/**
 * One evaluation the origin search made against the closed revision corpus — a
 * single revision it read and tested for the phrase, with the window it was
 * narrowing at the time. The ordered list of these *is* the descent: the
 * sampling sweep, then the bisection converging on the first occurrence. It's a
 * deterministic by-product of the search (same history → same probes), so it
 * belongs on the result, not just in a loading spinner.
 */
export interface SearchProbe {
  /** Monotonic order in which the search evaluated this position. */
  step: number;
  /** Position in the corpus, 0 = oldest revision, corpusSize-1 = newest. */
  index: number;
  revid: number;
  /** ISO timestamp of the probed revision (for date labels on the axis). */
  timestamp: string;
  /** Search window lower bound (inclusive) at the moment of this probe. */
  lo: number;
  /** Search window upper bound (exclusive) at the moment of this probe. */
  hi: number;
  /** Did this revision contain the phrase? */
  hit: boolean;
  /** Which half of the algorithm took this probe: the coarse sampling sweep
   *  that finds *a* band, or the bisection that walks to its left edge. */
  kind: "sample" | "bisect";
}
