export type Verdict =
  | "born-sourced"
  | "retrofit"
  // Mirror of retrofit: born with a citation, later stripped of it — the claim
  // now stands unsourced. Without this, a born-sourced badge (health "sourced")
  // sits over a claim the timeline shows as currently uncited.
  | "source-lost"
  | "churn"
  | "unsourced-stable"
  | "contested"
  | "ambiguous"
  // Terminal state: the claim existed and is gone from the current revision. Not
  // a sourcing pattern — it dominates the badge, because every other verdict
  // asserts something about a claim that is still present.
  | "removed";
