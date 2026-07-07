import type { SourceType } from "./SourceType";

export interface ClaimSource {
  label: string;
  year?: number;
  type: SourceType;
  /** Optional display override for the source type tag (e.g. "site de turismo"). */
  typeLabel?: string;
  url?: string;
  note?: string;
}
