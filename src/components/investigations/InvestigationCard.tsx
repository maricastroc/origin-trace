import { ArrowRight } from "lucide-react";
import type { Investigation } from "@/investigations";
import { phenomenonById } from "@/investigations";
import { VerdictBadge } from "../case-file/VerdictBadge";
import { coveragePct, isTrace } from "./view";

export function InvestigationCard({
  inv,
  active,
  onSelect,
}: {
  inv: Investigation;
  active: boolean;
  onSelect: () => void;
}) {
  const phenomenon = phenomenonById(inv.phenomenon);
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`group relative flex h-full flex-col rounded-xl border bg-surface-2 p-5 text-left transition-all duration-200 ${
        active
          ? "border-accent shadow-[0_18px_40px_-28px_rgba(138,43,38,0.5)]"
          : "border-line-strong hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_18px_40px_-30px_rgba(90,60,30,0.4)]"
      }`}
    >
      {active && (
        <span
          className="absolute -left-px top-5 h-8 w-0.75 rounded-r bg-accent"
          aria-hidden="true"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
          {phenomenon.label}
        </span>
        {isTrace(inv) ? (
          <VerdictBadge verdict={inv.data.verdict.primary} />
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral/45 bg-neutral-bg px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-neutral">
            {coveragePct(inv)}% cited
          </span>
        )}
      </div>

      <h3 className="mt-4 font-display text-[19px] font-medium leading-snug tracking-[-0.01em] text-ink">
        {inv.title}
      </h3>

      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
        {inv.dek}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
          pinned {inv.pinnedAt}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] transition-colors ${
            active ? "text-accent" : "text-ink-faint group-hover:text-ink"
          }`}
        >
          {active ? "open" : "read"}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </button>
  );
}
