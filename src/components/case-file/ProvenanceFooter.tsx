import type { ClaimProvenance } from "@/types/ClaimProvenance";

/** The seam, made visible: how this case file was produced. */
const GENERATOR: Record<
  ClaimProvenance["meta"]["generatedBy"],
  { label: string; live: boolean }
> = {
  "manual-trace": { label: "manual trace", live: false },
  "wikiblame-pipeline": { label: "WikiBlame engine", live: true },
};

export function ProvenanceFooter({ meta }: { meta: ClaimProvenance["meta"] }) {
  const gen = GENERATOR[meta.generatedBy];
  return (
    <div className="rounded-lg border border-line bg-surface-1/50 px-4 py-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
        {gen.live && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
            aria-hidden="true"
          />
        )}
        <span className="text-ink-muted">provenance</span>
        <span aria-hidden="true">·</span>
        <span className={gen.live ? "text-accent" : "text-ink-muted"}>
          {gen.label}
        </span>
        {meta.fetchedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span className="normal-case tracking-normal">
              {formatFetchedAt(meta.fetchedAt)}
            </span>
          </>
        )}
      </p>
      {meta.notes && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
          {meta.notes}
        </p>
      )}
    </div>
  );
}

function formatFetchedAt(iso: string): string {
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}
