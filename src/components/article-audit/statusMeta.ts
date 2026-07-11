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
    label: "Note, not a source",
  },
  unsourced: {
    Icon: Minus,
    className: "text-ink-muted",
    label: "No inline citation",
  },
};
