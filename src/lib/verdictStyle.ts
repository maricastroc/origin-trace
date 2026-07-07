import type { Verdict } from "@/types/Verdict";

interface VerdictStyle {
  label: string;
  /** Full Tailwind classes for the badge chip. */
  chip: string;
  /** Full Tailwind classes for the status dot. */
  dot: string;
}

/**
 * Maps the semantic verdict to presentation. This is the ONLY place the
 * engine's meaning becomes a color — the contract itself stays styling-free.
 */
export const verdictStyle: Record<Verdict, VerdictStyle> = {
  "born-sourced": {
    label: "born-sourced",
    chip: "bg-success-bg text-success",
    dot: "bg-success",
  },
  retrofit: {
    label: "retrofit",
    chip: "bg-danger-bg text-danger",
    dot: "bg-danger",
  },
  churn: {
    label: "churn",
    chip: "bg-warn-bg text-warn",
    dot: "bg-warn",
  },
  "unsourced-stable": {
    label: "unsourced-stable",
    chip: "bg-danger-bg text-danger",
    dot: "bg-danger",
  },
  contested: {
    label: "contested",
    chip: "bg-warn-bg text-warn",
    dot: "bg-warn",
  },
  ambiguous: {
    label: "veredito ambíguo",
    chip: "bg-surface-1 text-ink-muted",
    dot: "bg-ink-muted",
  },
};
