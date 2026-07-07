import type { Transition } from "@/types/Transition";
import { changeTagLabel } from "@/lib/changeTagLabel";
import { SwapIcon } from "./icons";

export function TransitionLabel({ transition }: { transition: Transition }) {
  const isMajor = transition.magnitude === "major";
  const tone = isMajor
    ? "border-danger/40 bg-danger-bg text-danger"
    : "border-warn/40 bg-warn-bg text-warn";
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${tone}`}
      >
        <SwapIcon className="h-3 w-3" />
        {transition.changes.map((c) => changeTagLabel[c]).join(" · ")}
        <span className="opacity-70">· {isMajor ? "major" : "minor"}</span>
      </span>
      {transition.note && (
        <span className="font-voice text-[13px] italic text-ink-muted">
          {transition.note}
        </span>
      )}
    </div>
  );
}
