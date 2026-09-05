export interface SearchProbe {
  step: number;
  index: number;
  revid: number;
  timestamp: string;
  lo: number;
  hi: number;
  hit: boolean;
  kind: "sample" | "bisect";
}
