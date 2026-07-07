import type { ClaimSource } from "@/types/ClaimSource";
import { sourceTypeLabel } from "@/lib/sourceTypeLabel";
import { LinkIcon } from "./icons";

export function SourceChip({ source }: { source: ClaimSource }) {
  const typeText = source.typeLabel ?? sourceTypeLabel[source.type];
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md bg-surface-1 px-2.5 py-1.5">
      <LinkIcon className="h-4 w-4 text-ink-faint" />
      <span className="text-[13px] text-ink">
        {source.label}
        {source.year ? ` (${source.year})` : ""}
      </span>
      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted">
        {typeText}
      </span>
      {source.note && (
        <span className="text-[11px] italic text-ink-muted">{source.note}</span>
      )}
    </div>
  );
}
