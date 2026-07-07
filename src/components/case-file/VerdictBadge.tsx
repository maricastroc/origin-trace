import type { Confidence } from "@/types/Confidence";
import type { Verdict } from "@/types/Verdict";
import { confidenceLabel } from "@/lib/confidenceLabel";
import { verdictStyle } from "@/lib/verdictStyle";

export function VerdictBadge({
  verdict,
  confidence,
}: {
  verdict: Verdict;
  confidence: Confidence;
}) {
  const style = verdictStyle[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-medium ${style.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label} · conf. {confidenceLabel[confidence]}
    </span>
  );
}
