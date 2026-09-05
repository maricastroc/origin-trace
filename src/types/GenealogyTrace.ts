export interface GenealogyStep {
  wording: string;
  date: string;
  revId: number;
  sourced: boolean;
  sourceLabel: string | null;
  anchorsShared: string[];
  overlap?: number;
}

export interface GenealogyTrace {
  steps: GenealogyStep[];

  terminus: string;
  residual: "resolved" | "more-determinism" | "semantic" | "unrecoverable";
  movedEarlier: boolean;
  nonMonotonic: boolean;
}
