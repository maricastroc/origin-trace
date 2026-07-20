import type { Confidence } from "./Confidence";
import type { SearchTrace } from "./SearchTrace";
import type { TimelineEvent } from "./TimelineEvent";
import type { Verdict } from "./Verdict";
import type { VerdictReading } from "./VerdictReading";

export interface ClaimProvenance {
  claim: {
    text: string;
    article: string;
    articleUrl?: string;
    lang?: string;
  };
  verdict: {
    primary: Verdict;
    confidence: Confidence;
    /** The uncertainties that lowered `confidence`, most concerning first.
     *  Empty/absent when nothing undermined the trace (a `high` verdict). */
    confidenceReasons?: string[];
    summary: string;
    readings?: VerdictReading[];
  };
  timeline: TimelineEvent[];
  /** The origin search's descent over the closed corpus — the sampling sweep and
   *  the bisection that converged on the first occurrence. Present on every live
   *  trace; absent only on hand-authored fixtures that predate it. */
  search?: SearchTrace;
  credibilityRead: string;
  sourceQuality?: {
    note: string;
    flags: string[];
  };
  annotations?: {
    circularLoop?: {
      cycle: { actor: string; year: number; action: string }[];
      note: string;
    };
    unsourcedGap?: {
      note: string;
    };
  };
  meta: {
    generatedBy: "manual-trace" | "wikiblame-pipeline";
    fetchedAt?: string;
    notes?: string;
    corpus?: {
      read?: number;
      total: number;
      truncated: boolean;
      /** True only if the search read every revision below the origin and found
       *  it absent — the origin is the proven first occurrence. False/absent
       *  when the sub-origin range was sampled: a valid occurrence was found,
       *  but a sparse earlier one cannot be ruled out. */
      originProven?: boolean;
    };
  };
}
