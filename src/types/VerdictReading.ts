import type { Verdict } from "./Verdict";

/** One interpretation of an ambiguous case (used when verdict.primary === "ambiguous"). */
export interface VerdictReading {
  lens: string;
  verdict: Verdict;
  reason: string;
}
