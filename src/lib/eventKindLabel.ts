import type { EventKind } from "@/types/EventKind";

export const eventKindLabel: Record<EventKind, string> = {
  "claim-absent": "· a afirmação não existe",
  "claim-introduced": "· afirmação criada",
  reworded: "· reformulada",
  "source-added": "· fonte adicionada",
  "source-replaced": "· fonte substituída",
  removed: "· removida",
  current: "· texto atual",
};
