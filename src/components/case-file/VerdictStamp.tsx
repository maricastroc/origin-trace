import type { Confidence } from "@/types/Confidence";
import type { Verdict } from "@/types/Verdict";
import { confidenceLabel } from "@/lib/confidenceLabel";
import { verdictStyle } from "@/lib/verdictStyle";

export function VerdictStamp({
  verdict,
  confidence,
  confidenceReasons,
  size = "md",
}: {
  verdict: Verdict;
  confidence?: Confidence;
  confidenceReasons?: string[];
  size?: "sm" | "md";
}) {
  const s = verdictStyle[verdict];

  const pad = size === "sm" ? "px-2.5 py-1" : "px-3.5 py-1.5";

  const type = size === "sm" ? "text-[11px]" : "text-[13px]";
  return (
    <span
      className={`inline-flex -rotate-2 flex-col items-center rounded-[3px] border-2 outline outline-offset-[3px] ${s.border} ${s.tint} ${pad} ${s.border.replace("border-", "outline-")}`}
    >
      <span
        className={`font-mono font-semibold uppercase leading-none tracking-[0.16em] ${type} ${s.ink}`}
      >
        {s.label}
      </span>
      {confidence && (
        <span
          className={`mt-1 font-mono text-[9px] uppercase tracking-[0.12em] ${s.ink} opacity-70`}
          title={
            confidenceReasons?.length
              ? `Confidence ${confidence} — ${confidenceReasons.join("; ")}`
              : `Confidence ${confidence} — traced to a clean origin with no caveats`
          }
        >
          conf. {confidenceLabel[confidence]}
        </span>
      )}
    </span>
  );
}
