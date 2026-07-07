import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import { countMatching, type AuditFilter } from "@/lib/auditMetrics";
import { SectionRow } from "./SectionRow";

export function AuditMap({
  data,
  filter,
  expanded,
  onToggle,
}: {
  data: ArticleAuditData;
  filter: AuditFilter;
  expanded: Set<number>;
  onToggle: (index: number) => void;
}) {
  const rows = data.sections
    .map((section, index) => ({ section, index }))
    .filter(
      ({ section }) =>
        filter === "all" || countMatching(section.claims, filter) > 0,
    );

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between px-2.5 pb-2">
        <p className="kicker">{"the map · by section"}</p>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
          {rows.length} {rows.length === 1 ? "section" : "sections"}
        </span>
      </div>

      <div className="divide-y divide-line/70 rounded-xl border border-line-strong bg-surface-2/40 px-1.5 py-1">
        {rows.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[13px] text-ink-faint">
            No sentences match this filter.
          </p>
        ) : (
          rows.map(({ section, index }) => (
            <SectionRow
              key={index}
              section={section}
              index={index}
              article={data.article}
              filter={filter}
              open={expanded.has(index)}
              onToggle={() => onToggle(index)}
            />
          ))
        )}
      </div>
    </div>
  );
}
