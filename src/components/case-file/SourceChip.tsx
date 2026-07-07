import type { ClaimSource } from "@/types/ClaimSource";
import { sourceTypeLabel } from "@/lib/sourceTypeLabel";
import { LinkIcon } from "./icons";

export function SourceChip({ source }: { source: ClaimSource }) {
  const typeText = source.typeLabel ?? sourceTypeLabel[source.type];
  const label = (
    <span className="text-[13px] font-medium text-ink">
      {source.label}
      {source.year ? ` (${source.year})` : ""}
    </span>
  );
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-1 px-2.5 py-1.5">
      <LinkIcon className="h-4 w-4 text-ink-faint" />
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent"
        >
          {label}
        </a>
      ) : (
        label
      )}
      <span className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        {typeText}
      </span>
      {source.note && (
        <span className="font-voice text-[12px] italic text-ink-muted">
          {source.note}
        </span>
      )}
    </div>
  );
}
