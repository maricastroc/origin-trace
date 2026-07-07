import type { Confidence } from "./Confidence";
import type { TimelineEvent } from "./TimelineEvent";
import type { Verdict } from "./Verdict";
import type { VerdictReading } from "./VerdictReading";

/**
 * The intermediate data contract. The UI consumes this; the engine
 * (manual trace today, WikiBlame pipeline tomorrow) produces it.
 * It carries semantics, never styling — the UI maps verdict/type to color.
 */
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
    /** The badge is a summary of the timeline, not the product. */
    summary: string;
    /** Present when primary === "ambiguous". */
    readings?: VerdictReading[];
  };
  /** The protagonist. */
  timeline: TimelineEvent[];
  credibilityRead: string;
  /** Provenance ≠ source quality — a separate axis. */
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
  /** Transparency: how this object was produced. */
  meta: {
    generatedBy: "manual-trace" | "wikiblame-pipeline";
    fetchedAt?: string;
    notes?: string;
    /**
     * The closed-corpus receipt: how much of the history the engine had to read
     * to pin the origin. Present only for live engine traces.
     */
    corpus?: {
      /**
       * Revisions whose content the binary search actually read. Present for
       * live engine traces; omitted for hand traces, which enumerate the
       * closed corpus without a binary-search read count.
       */
      read?: number;
      /** Total revisions in the enumerated history. */
      total: number;
      /** History was cut short by the page cap — closure unproven. */
      truncated: boolean;
    };
  };
}
