import { Search, X } from "lucide-react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import {
  countMatching,
  sectionMetrics,
  type AuditSort,
} from "@/lib/auditMetrics";
import { SectionRow } from "./SectionRow";

interface Row {
  section: ArticleAuditData["sections"][number];
  index: number;
  coverage: number;
  unsourced: number;
  high: number;
}

const COMPARATORS: Record<AuditSort, (a: Row, b: Row) => number> = {
  article: (a, b) => a.index - b.index,
  "coverage-asc": (a, b) => a.coverage - b.coverage || a.index - b.index,
  "coverage-desc": (a, b) => b.coverage - a.coverage || a.index - b.index,
  uncited: (a, b) => b.unsourced - a.unsourced || a.index - b.index,
  high: (a, b) => b.high - a.high || a.index - b.index,
};

export function AuditMap({
  data,
  predicate,
  active,
  query,
  onQuery,
  sort,
  expanded,
  onToggle,
  mapHeight,
}: {
  data: ArticleAuditData;
  predicate: (claim: AuditClaim) => boolean;
  active: boolean;
  query: string;
  onQuery: (q: string) => void;
  sort: AuditSort;
  expanded: Set<number>;
  onToggle: (index: number) => void;
  mapHeight?: number | null;
}) {
  const all: Row[] = data.sections.map((section, index) => {
    const m = sectionMetrics(section);
    return {
      section,
      index,
      coverage: m.coverage,
      unsourced: m.unsourced,
      high: countMatching(section.claims, "high"),
    };
  });

  const visible = active
    ? all.filter((r) => r.section.claims.some(predicate))
    : all;

  const rows =
    sort === "article"
      ? [...visible].sort((a, b) => a.index - b.index)
      : [
          ...visible.filter((r) => r.section.isLead),
          ...visible.filter((r) => !r.section.isLead).sort(COMPARATORS[sort]),
        ];

  return (
    <div
      className="flex min-w-0 flex-col lg:h-(--map-h,74vh)"
      style={
        mapHeight
          ? ({ "--map-h": `${mapHeight}px` } as React.CSSProperties)
          : undefined
      }
    >
      <label className="mb-3 flex shrink-0 items-center gap-2.5 rounded-lg border border-line-strong bg-surface-2/50 px-3 py-2 transition-colors focus-within:border-accent">
        <Search
          className="h-3.5 w-3.5 shrink-0 text-ink-faint"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find in article…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-ghost"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition-colors hover:bg-surface-1 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <div className="flex shrink-0 items-center justify-between px-2.5 pb-2">
        <p className="kicker">{"the map · by section"}</p>
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-faint">
          {rows.length} {rows.length === 1 ? "section" : "sections"}
        </span>
      </div>

      <div className="scroll-panel min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto rounded-xl border border-line-strong bg-surface-2/40 px-1.5 py-1">
        {rows.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[13px] text-ink-faint">
            {query.trim()
              ? `Nothing matches “${query.trim()}”.`
              : "No sentences match this filter."}
          </p>
        ) : (
          rows.map((r) => (
            <SectionRow
              key={r.index}
              section={r.section}
              index={r.index}
              article={data.article}
              predicate={predicate}
              active={active}
              query={query}
              open={expanded.has(r.index)}
              onToggle={() => onToggle(r.index)}
            />
          ))
        )}
      </div>
    </div>
  );
}
