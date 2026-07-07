import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { verdictStyle } from "@/lib/verdictStyle";

export function VerdictSummary({
  verdict,
}: {
  verdict: ClaimProvenance["verdict"];
}) {
  const style = verdictStyle[verdict.primary];
  return (
    <div className="flex items-center gap-2.5 border-t border-line pt-3">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      <p className="text-[13px] text-ink-muted">
        <span className="font-medium text-ink">{style.label}</span> — é só o
        resumo da história acima, não o produto.
      </p>
    </div>
  );
}
