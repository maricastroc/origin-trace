import type { SourceType } from "./SourceType";

export interface ClaimSource {
  label: string;
  year?: number;
  type: SourceType;
  typeLabel?: string;
  url?: string;
  note?: string;
}
