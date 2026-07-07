import type { ChangeTag } from "@/types/ChangeTag";

export const changeTagLabel: Record<ChangeTag, string> = {
  reworded: "reworded",
  reframed: "reframed",
  "evidence-changed": "source swapped",
  "number-changed": "number changed",
  expanded: "expanded",
};
