import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { VerdictBadge } from "./VerdictBadge";

export function CaseFileHeader({
  claim,
  verdict,
}: Pick<ClaimProvenance, "claim" | "verdict">) {
  return (
    <header className="rounded-xl border border-line bg-surface-2 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Origin Trace · artigo: {claim.article}
          </p>
          <p className="font-voice text-lg leading-snug text-ink">
            &ldquo;{claim.text}&rdquo;
          </p>
        </div>
        <VerdictBadge verdict={verdict.primary} confidence={verdict.confidence} />
      </div>
    </header>
  );
}
