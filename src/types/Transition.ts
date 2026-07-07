import type { ChangeTag } from "./ChangeTag";

/** The change that produced a timeline event from the one before it. */
export interface Transition {
  changes: ChangeTag[];
  magnitude: "minor" | "major";
  note?: string;
}
