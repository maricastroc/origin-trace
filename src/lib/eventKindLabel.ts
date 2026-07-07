import type { EventKind } from "@/types/EventKind";

export const eventKindLabel: Record<EventKind, string> = {
  "claim-absent": "· claim absent",
  "claim-introduced": "· claim introduced",
  reworded: "· reworded",
  "source-added": "· source added",
  "source-replaced": "· source replaced",
  removed: "· removed",
  current: "· current text",
};
