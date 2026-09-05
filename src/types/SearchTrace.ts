import type { SearchProbe } from "./SearchProbe";

export interface SearchTrace {
  corpusSize: number;
  reads: number;
  probes: SearchProbe[];
  originIndex: number;
  originRevId: number;
  originProven: boolean;
  searchTruncated: boolean;
  searchedRevisions: number;
  totalCandidateRevisions: number;
  stopReason: "complete" | "budget-exhausted";
  span: { from: string; to: string };
}
