import type { Confidence } from "@/types/Confidence";
import type { Verdict } from "@/types/Verdict";
import { confidenceLabel } from "@/lib/confidenceLabel";
import { verdictStyle } from "@/lib/verdictStyle";

export function VerdictBadge({
  verdict,
  confidence,
}: {
  verdict: Verdict;
  confidence?: Confidence;
}) {
  const s = verdictStyle[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] ${s.border}/45 ${s.tint} ${s.ink}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
      {confidence && (
        <span className="opacity-70">· {confidenceLabel[confidence]}</span>
      )}
    </span>
  );
}
