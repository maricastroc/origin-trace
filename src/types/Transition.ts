import type { ChangeTag } from "./ChangeTag";

export interface Transition {
  changes: ChangeTag[];
  magnitude: "minor" | "major";
  note?: string;
}
