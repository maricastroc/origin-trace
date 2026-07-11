import type { Verdict } from "@/types/Verdict";
import { verdictStyle } from "@/lib/verdictStyle";

export function VerdictStamp({
  verdict,
  size = "md",
}: {
  verdict: Verdict;
  size?: "sm" | "md";
}) {
  const s = verdictStyle[verdict];

  const pad = size === "sm" ? "px-2.5 py-1" : "px-3.5 py-1.5";

  const type = size === "sm" ? "text-[11px]" : "text-[13px]";
  return (
    <span
      className={`inline-flex -rotate-2 items-center rounded-[3px] border-2 outline outline-offset-[3px] ${s.border} ${s.tint} ${pad} ${s.border.replace("border-", "outline-")}`}
    >
      <span
        className={`font-mono font-semibold uppercase leading-none tracking-[0.16em] ${type} ${s.ink}`}
      >
        {s.label}
      </span>
    </span>
  );
}
