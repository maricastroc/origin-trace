import type { ClaimProvenance } from "@/types/ClaimProvenance";

/** The seam, made visible: how this case file was produced. */
const GENERATOR: Record<
  ClaimProvenance["meta"]["generatedBy"],
  { label: string; live: boolean }
> = {
  "manual-trace": { label: "trace manual", live: false },
  "wikiblame-pipeline": { label: "motor WikiBlame", live: true },
};

export function ProvenanceFooter({ meta }: { meta: ClaimProvenance["meta"] }) {
  const gen = GENERATOR[meta.generatedBy];
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        {gen.live && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
            aria-hidden="true"
          />
        )}
        <span>proveniência: {gen.label}</span>
        {meta.fetchedAt && (
          <span className="normal-case tracking-normal text-ink-faint">
            · {formatFetchedAt(meta.fetchedAt)}
          </span>
        )}
      </p>
      {meta.notes && (
        <p className="text-[12px] leading-relaxed text-ink-faint">{meta.notes}</p>
      )}
    </div>
  );
}

function formatFetchedAt(iso: string): string {
  // Keep it stable across locales/timezones: date + minute, UTC.
  const t = iso.replace("T", " ").slice(0, 16);
  return `${t} UTC`;
}
