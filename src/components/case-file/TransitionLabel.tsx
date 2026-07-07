import type { Transition } from "@/types/Transition";
import { changeTagLabel } from "@/lib/changeTagLabel";
import { SwapIcon } from "./icons";

export function TransitionLabel({ transition }: { transition: Transition }) {
  const isMajor = transition.magnitude === "major";
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
        <SwapIcon
          className={`h-3 w-3 ${isMajor ? "text-danger" : "text-warn"}`}
        />
        {transition.changes.map((c) => changeTagLabel[c]).join(" · ")}
        <span className="text-ink-faint">· {isMajor ? "major" : "minor"}</span>
      </span>
      {transition.note && (
        <span className="text-[11px] italic text-ink-muted">
          {transition.note}
        </span>
      )}
    </div>
  );
}
