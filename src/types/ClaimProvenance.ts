import type { Confidence } from "./Confidence";
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
    summary: string;
    readings?: VerdictReading[];
  };
  timeline: TimelineEvent[];
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
    };
  };
}
