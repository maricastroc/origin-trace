import type { Verdict } from "@/types/Verdict";

export type Severity = "good" | "caution" | "warn" | "alert" | "neutral";

interface VerdictStyle {
  label: string;
  health: string;
  gloss: string;
  meaning: string;
  severity: Severity;
  rank: number;
  tint: string;
  ink: string;
  border: string;
  dot: string;
}

const PALETTE: Record<Severity, Pick<VerdictStyle, "tint" | "ink" | "border" | "dot">> = {
  good: { tint: "bg-success-bg", ink: "text-success", border: "border-success", dot: "bg-success" },
  caution: { tint: "bg-warn-bg", ink: "text-warn", border: "border-warn", dot: "bg-warn" },
  warn: { tint: "bg-warn-bg", ink: "text-warn", border: "border-warn", dot: "bg-warn" },
  alert: { tint: "bg-danger-bg", ink: "text-danger", border: "border-danger", dot: "bg-danger" },
  neutral: { tint: "bg-neutral-bg", ink: "text-neutral", border: "border-neutral", dot: "bg-neutral" },
};

export const verdictStyle: Record<Verdict, VerdictStyle> = {
  "born-sourced": {
    label: "born-sourced",
    health: "sourced",
    gloss: "claim and citation entered together",
    meaning:
      "Entered the article already backed by a citation — its evidence is as old as the claim.",
    severity: "good",
    rank: 1,
    ...PALETTE.good,
  },
  retrofit: {
    label: "retrofit",
    health: "back-filled",
    gloss: "born unsourced; citation attached later",
    meaning:
      "Lived as unsourced fact first; a citation was attached only later. The backing is retroactive.",
    severity: "caution",
    rank: 3,
    ...PALETTE.caution,
  },
  "source-lost": {
    label: "source-lost",
    health: "unsourced",
    gloss: "born cited, since stripped of its source",
    meaning:
      "Entered the article with a citation, but that citation was later removed — the claim now stands unsourced. Its evidence was there and is gone.",
    // Not the single critical red (that stays unsourced-stable): it once had backing.
    severity: "warn",
    rank: 4,
    ...PALETTE.warn,
  },
  churn: {
    label: "churn",
    health: "unstable",
    gloss: "the evidence was swapped repeatedly",
    meaning:
      "Stayed in the article while its citation was swapped again and again — the evidence keeps shifting underneath it.",
    severity: "warn",
    rank: 4,
    ...PALETTE.warn,
  },
  contested: {
    label: "contested",
    health: "contested",
    gloss: "reverted / edit war",
    meaning:
      "Reverted or fought over — its place in the article is disputed.",
    severity: "warn",
    rank: 5,
    ...PALETTE.warn,
  },
  "unsourced-stable": {
    label: "unsourced-stable",
    health: "unsourced",
    gloss: "never sourced, never removed",
    meaning:
      "Has carried no citation in its entire history, yet no one has removed it — presented as fact, never backed.",
    severity: "alert",
    rank: 6,
    ...PALETTE.alert,
  },
  ambiguous: {
    label: "ambiguous",
    health: "ambiguous",
    gloss: "the verdict depends on what counts as the claim",
    meaning:
      "The verdict flips depending on where you draw the line around “the same claim” — so both readings are shown.",
    severity: "neutral",
    rank: 7,
    ...PALETTE.neutral,
  },
  removed: {
    label: "removed",
    health: "removed",
    gloss: "introduced, then taken out",
    meaning:
      "Existed in the article and was later removed. Its window of presence is traced down to the revision that introduced it — the current revision carries no such claim to source.",
    severity: "neutral",
    rank: 2,
    ...PALETTE.neutral,
  },
};
