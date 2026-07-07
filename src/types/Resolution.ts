import type { Candidate } from "./Candidate";

export interface Resolution {
  phrase: string;
  scope: "unambiguous" | "ambiguous" | "not-found";
  resolved: string | null;
  candidates: Candidate[];
  note: string;
}
