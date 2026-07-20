import type { SearchProbe } from "./SearchProbe";

/**
 * The record of the origin search over the closed corpus — enough to redraw the
 * whole descent after the fact, so a reviewer landing on a finished case file
 * (or a shared permalink) sees the algorithm work, not just its verdict.
 *
 * Every field is a deterministic function of the revision history: run the trace
 * twice and you get the same descent.
 */
export interface SearchTrace {
  /** Revisions in the enumerated corpus — the denominator of "read N of M". */
  corpusSize: number;
  /** Distinct revisions actually read during the search (~log₂ of corpusSize). */
  reads: number;
  /** The probes, in evaluation order. */
  probes: SearchProbe[];
  /** Corpus position the search settled on as the origin. */
  originIndex: number;
  originRevId: number;
  /** True only when every revision below the origin was read and found absent —
   *  a proven first occurrence, not merely the earliest sampled. Mirrors
   *  meta.corpus.originProven. */
  originProven: boolean;
  /** Year of the oldest and newest revision, for the axis endpoints. */
  span: { from: string; to: string };
}
