import type { SourceType } from "@/types/SourceType";

export const sourceTypeLabel: Record<SourceType, string> = {
  "peer-reviewed": "revisado por pares",
  newspaper: "jornal",
  "popular-media": "mídia popular",
  "travel-site": "site de turismo",
  "self-published": "autopublicada",
  other: "fonte",
};
