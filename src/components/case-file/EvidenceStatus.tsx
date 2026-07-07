import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { deriveSignals } from "@/lib/evidenceSignals";
import { verdictStyle } from "@/lib/verdictStyle";
import { VerdictStamp } from "./VerdictStamp";

/**
 * The answer, up top: not "when did it appear" but "what is the epistemic state
 * of this claim." Leads the case file; the timeline below is the auditable
 * evidence for it.
 */
export function EvidenceStatus({ data }: { data: ClaimProvenance }) {
  const s = verdictStyle[data.verdict.primary];
  const signals = deriveSignals(data.timeline, new Date());
  const alert = s.severity === "alert";

  return (
    <section
      className={`rounded-xl border p-5 ${
        alert ? "border-danger/35 bg-danger-bg" : "border-line-strong bg-surface-1/50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            evidence status
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span
              className={`h-2.5 w-2.5 self-center rounded-full ${s.dot}`}
              aria-hidden="true"
            />
            <span
              className={`font-display text-[26px] leading-none ${
                alert ? "text-danger" : "text-ink"
              }`}
            >
              {s.health}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
              {s.label}
            </span>
          </div>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-muted">
            {s.meaning}
          </p>
        </div>
        <div className="shrink-0">
          <VerdictStamp
            verdict={data.verdict.primary}
            confidence={data.verdict.confidence}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {signals.ageLabel && <Signal>age · {signals.ageLabel}</Signal>}
        {signals.sourcedNow === "no" && (
          <Signal tone="danger">unsourced now</Signal>
        )}
        {signals.sourcedNow === "yes" && (
          <Signal tone="ok">
            sourced now
            {signals.currentSourceLabel ? ` · ${signals.currentSourceLabel}` : ""}
          </Signal>
        )}
        {signals.sourcedNow === "removed" && (
          <Signal>removed from article</Signal>
        )}
        {signals.evidenceChanges >= 2 && (
          <Signal tone="warn">evidence changed {signals.evidenceChanges}×</Signal>
        )}
      </div>
    </section>
  );
}

function Signal({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "danger" | "ok" | "warn";
}) {
  const c =
    tone === "danger"
      ? "border-danger/40 text-danger"
      : tone === "ok"
        ? "border-success/40 text-success"
        : tone === "warn"
          ? "border-warn/40 text-warn"
          : "border-line-strong text-ink-muted";
  return (
    <span
      className={`rounded-full border bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] ${c}`}
    >
      {children}
    </span>
  );
}
