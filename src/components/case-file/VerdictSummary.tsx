import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { verdictStyle } from "@/lib/verdictStyle";

export function VerdictSummary({
  verdict,
}: {
  verdict: ClaimProvenance["verdict"];
}) {
  const style = verdictStyle[verdict.primary];
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      <p className="text-[13px] leading-relaxed text-ink-muted">
        <span className="font-mono text-ink">{style.label}</span> — {style.gloss}.
        The stamp is just the summary of the story above, not the product.
      </p>
    </div>
  );
}
