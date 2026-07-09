import { Check, Minus, TriangleAlert, type LucideIcon } from "lucide-react";
import type { SentenceStatus } from "@/types/SentenceStatus";

export const STATUS_META: Record<
  SentenceStatus,
  { Icon: LucideIcon; className: string; label: string }
> = {
  sourced: { Icon: Check, className: "text-success", label: "Inline citation" },
  "note-only": {
    Icon: TriangleAlert,
    className: "text-warn",
    // Canonical phrasing, echoing the project's "a note is not a source" principle.
    label: "Note, not a source",
  },
  // Plain "no inline citation" is descriptive, not a verdict — so it reads neutral
  // (a muted dash), not danger-red. The alarm colour is reserved for the
  // high-impact band, where an uncited claim is genuinely worth worrying about.
  unsourced: {
    Icon: Minus,
    className: "text-ink-muted",
    label: "No inline citation",
  },
};
