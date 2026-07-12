import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditModel } from "@/lib/auditModel";
import { Chip } from "./Chip";
import { CoverageBar } from "./CoverageBar";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <span className="font-display text-[19px] leading-none text-ink tabular-nums">
        {value}
      </span>
      {sub && (
        <span className="truncate text-[11.5px] leading-tight text-ink-muted">
          {sub}
        </span>
      )}
    </div>
  );
}

export function AuditSummary({
  data,
  model,
}: {
  data: ArticleAuditData;
  model: AuditModel;
}) {
  const { body, lead, coverage } = data.summary;
  const pct = Math.round(coverage * 100);
  const worst = model.worstSections[0];
  const best = model.bestSection;

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="kicker">
            evidence health · {model.sectionCount} body sections
          </p>
          <div className="mt-2.5 flex items-end gap-3">
            <span className="font-display text-[34px] leading-none text-ink">
              {pct}%
            </span>
            <span className="mb-1 max-w-60 text-[12.5px] leading-snug text-ink-muted">
              of the body&rsquo;s {body.total} sentences carry an inline
              citation
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip tone="ok">{body.sourced} sourced</Chip>
          {body.noteOnly > 0 && (
            <Chip tone="warn">{body.noteOnly} note-only</Chip>
          )}
          <Chip>{body.unsourced} uncited</Chip>
        </div>
      </div>

      <CoverageBar
        sourced={body.sourced}
        noteOnly={body.noteOnly}
        unsourced={body.unsourced}
      />

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-3">
        <Stat
          label="sentences read"
          value={String(model.totals.sentences)}
          sub={lead.total > 0 ? `${body.total} body · ${lead.total} lead` : undefined}
        />
        <Stat label="sections mapped" value={String(data.sections.length)} />
        <Stat
          label="high-impact claims"
          value={String(model.highImpact.length)}
        />
        <Stat
          label="weakest body section"
          value={worst ? `${Math.round(worst.metrics.coverage * 100)}%` : "—"}
          sub={worst ? worst.label : undefined}
        />
        <Stat
          label="strongest body section"
          value={best ? `${Math.round(best.metrics.coverage * 100)}%` : "—"}
          sub={best ? best.label : undefined}
        />
        <Stat
          label="longest uncited run"
          value={model.longestRun ? `${model.longestRun.count}` : "—"}
          sub={model.longestRun ? `in ${model.longestRun.label}` : undefined}
        />
      </dl>

      <div className="mt-4 flex flex-col gap-2 text-[12.5px] leading-relaxed text-ink-faint">
        <p>
          <span className="text-ink-muted">
            Coverage counts whether a sentence carries an inline citation — not
            whether that citation supports it.
          </span>{" "}
          The gap between &ldquo;has a source&rdquo; and &ldquo;the source
          checks out&rdquo; is where citogenesis hides, and it&rsquo;s the one
          thing this map can&rsquo;t see. That&rsquo;s what the trace is for.
        </p>
        {lead.total > 0 && (
          <p>
            <span className="text-ink-muted">Lead:</span> {lead.sourced} of{" "}
            {lead.total} sentences cited inline — the rest are conventionally
            sourced in the body (WP:LEADCITE), so they&rsquo;re counted apart
            and kept out of the section ranking.
          </p>
        )}
        <p>{data.meta.notes}</p>
      </div>
    </section>
  );
}
