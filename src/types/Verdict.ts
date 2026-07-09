export type Verdict =
  | "born-sourced"
  | "retrofit"
  | "churn"
  | "unsourced-stable"
  | "contested"
  | "ambiguous"
  // Terminal state: the claim existed and is gone from the current revision. Not
  // a sourcing pattern — it dominates the badge, because every other verdict
  // asserts something about a claim that is still present.
  | "removed";
