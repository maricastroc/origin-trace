import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import { Chip } from "./Chip";
import { CoverageBar } from "./CoverageBar";

export function AuditSummary({ data }: { data: ArticleAuditData }) {
  const { body, lead, coverage } = data.summary;
  const pct = Math.round(coverage * 100);

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="kicker">the audit · body</p>
          <div className="mt-2.5 flex items-end gap-3">
            <span className="font-display text-[34px] leading-none text-ink">
              {pct}%
            </span>
            <span className="mb-1 max-w-[15rem] text-[12.5px] leading-snug text-ink-muted">
              of the body&rsquo;s {body.total} sentences carry an inline citation
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip tone="ok">{body.sourced} sourced</Chip>
          {body.noteOnly > 0 && <Chip tone="warn">{body.noteOnly} note-only</Chip>}
          <Chip tone="danger">{body.unsourced} uncited</Chip>
        </div>
      </div>

      <CoverageBar
        sourced={body.sourced}
        noteOnly={body.noteOnly}
        unsourced={body.unsourced}
      />

      <div className="mt-4 flex flex-col gap-2 text-[12.5px] leading-relaxed text-ink-faint">
        {lead.total > 0 && (
          <p>
            <span className="text-ink-muted">Lead:</span> {lead.sourced} of{" "}
            {lead.total} sentences cited inline — the rest are conventionally
            sourced in the body (WP:LEADCITE), so they&rsquo;re counted apart.
          </p>
        )}
        <p>{data.meta.notes}</p>
      </div>
    </section>
  );
}
