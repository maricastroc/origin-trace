import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { Confidence } from "@/types/Confidence";
import { deriveSignals } from "@/lib/evidenceSignals";
import { verdictStyle } from "@/lib/verdictStyle";
import { VerdictStamp } from "./VerdictStamp";

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
            confidenceReasons={data.verdict.confidenceReasons}
          />
        </div>
      </div>

      <ConfidenceNote
        confidence={data.verdict.confidence}
        reasons={data.verdict.confidenceReasons}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {signals.ageLabel && <Signal>age · {signals.ageLabel}</Signal>}
        {signals.sourcedNow === "no" && (
          <Signal tone="danger">unsourced now</Signal>
        )}
        {signals.explanatoryNoteNow && (
          <Signal tone="warn">note, not a source</Signal>
        )}
        {signals.sourcedNow === "yes" && (
          <Signal tone="ok">
            sourced now
            {signals.currentSourceLabel ? ` · ${signals.currentSourceLabel}` : ""}
          </Signal>
        )}
        {signals.sourcedNow === "unreadable" && (
          <Signal>cited &middot; source unreadable</Signal>
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

function ConfidenceNote({
  confidence,
  reasons,
}: {
  confidence: Confidence;
  reasons?: string[];
}) {
  const tone =
    confidence === "high"
      ? "text-success"
      : confidence === "medium"
        ? "text-warn"
        : "text-danger";
  const dot =
    confidence === "high"
      ? "bg-success"
      : confidence === "medium"
        ? "bg-warn"
        : "bg-danger";
  const items = reasons ?? [];
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
          confidence
        </span>
        <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${tone}`}>
          {confidence}
        </span>
      </div>
      {items.length ? (
        <ul className="mt-2 space-y-1">
          {items.map((reason, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] leading-relaxed text-ink-muted"
            >
              <span className="select-none text-ink-faint" aria-hidden="true">
                –
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          Traced to a clean origin with both readings in agreement — nothing
          undermines this verdict.
        </p>
      )}
    </div>
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
