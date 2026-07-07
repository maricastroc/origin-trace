import type { Verdict } from "@/types/Verdict";

interface VerdictStyle {
  /** The enum, shown as-is — it is the product's vocabulary. */
  label: string;
  /** One-line gloss of what this verdict means. */
  gloss: string;
  /** Background wash (Tailwind class). */
  tint: string;
  /** Ink/foreground (Tailwind class). */
  ink: string;
  /** Border color (Tailwind class) — for the stamp. */
  border: string;
  /** Status dot background (Tailwind class). */
  dot: string;
}

/**
 * Maps the semantic verdict to presentation. This is the ONLY place the
 * engine's meaning becomes a color — the contract itself stays styling-free.
 * The palette reads like rubber stamps on a case file.
 */
export const verdictStyle: Record<Verdict, VerdictStyle> = {
  "born-sourced": {
    label: "born-sourced",
    gloss: "claim and citation entered together",
    tint: "bg-success-bg",
    ink: "text-success",
    border: "border-success",
    dot: "bg-success",
  },
  retrofit: {
    label: "retrofit",
    gloss: "born unsourced; citation attached later",
    tint: "bg-danger-bg",
    ink: "text-danger",
    border: "border-danger",
    dot: "bg-danger",
  },
  churn: {
    label: "churn",
    gloss: "the evidence was swapped repeatedly",
    tint: "bg-warn-bg",
    ink: "text-warn",
    border: "border-warn",
    dot: "bg-warn",
  },
  "unsourced-stable": {
    label: "unsourced-stable",
    gloss: "never sourced, never removed",
    tint: "bg-danger-bg",
    ink: "text-danger",
    border: "border-danger",
    dot: "bg-danger",
  },
  contested: {
    label: "contested",
    gloss: "reverted / edit war",
    tint: "bg-warn-bg",
    ink: "text-warn",
    border: "border-warn",
    dot: "bg-warn",
  },
  ambiguous: {
    label: "ambiguous",
    gloss: "the verdict depends on what counts as the claim",
    tint: "bg-neutral-bg",
    ink: "text-neutral",
    border: "border-neutral",
    dot: "bg-neutral",
  },
};
