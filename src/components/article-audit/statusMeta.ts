import { Check, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { SentenceStatus } from "@/types/SentenceStatus";

export const STATUS_META: Record<
  SentenceStatus,
  { Icon: LucideIcon; className: string; label: string }
> = {
  sourced: { Icon: Check, className: "text-success", label: "Inline citation" },
  "note-only": {
    Icon: TriangleAlert,
    className: "text-warn",
    label: "Note only, no source",
  },
  unsourced: { Icon: X, className: "text-danger", label: "No inline citation" },
};
