import type { SearchProbe } from "./SearchProbe";

export type TraceProgress =
  | { phase: "listing" }
  | { phase: "listed"; revisions: number; truncated: boolean }
  | { phase: "searching"; read: number; estimate: number; probe?: SearchProbe }
  | { phase: "located"; year: string; removed: boolean }
  | { phase: "reading" }
  | { phase: "detecting" }
  | { phase: "genealogy"; hop: number };
