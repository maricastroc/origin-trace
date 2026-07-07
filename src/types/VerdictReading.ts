import type { Verdict } from "./Verdict";

export interface VerdictReading {
  lens: string;
  verdict: Verdict;
  reason: string;
}
