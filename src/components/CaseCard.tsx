import type { CaseEntry } from "@/mocks";
import { VerdictBadge } from "./case-file/VerdictBadge";

export function CaseCard({
  entry,
  index,
  active,
  onSelect,
}: {
  entry: CaseEntry;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const n = String(index + 1).padStart(2, "0");
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
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          <span className="text-accent">case {n}</span> · {entry.data.claim.article}
        </span>
        <VerdictBadge verdict={entry.data.verdict.primary} />
      </div>

      <p className="mt-4 font-voice text-[19px] italic leading-snug text-ink">
        &ldquo;{entry.data.claim.text}&rdquo;
      </p>

      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
        {entry.hook}
      </p>

      <span
        className={`mt-4 inline-flex items-center gap-1.5 font-mono text-[12px] transition-colors ${
          active ? "text-accent" : "text-ink-faint group-hover:text-ink"
        }`}
      >
        {active ? "case open" : "open case"}
        <span className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </button>
  );
}
