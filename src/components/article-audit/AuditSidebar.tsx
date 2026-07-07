import type { AuditModel } from "@/lib/auditModel";
import type { AuditFilter } from "@/lib/auditMetrics";
import { FilterControl, type FilterOption } from "./FilterControl";
import { SegBar } from "./SegBar";

export function AuditSidebar({
  model,
  filter,
  options,
  onFilter,
  onJump,
}: {
  model: AuditModel;
  filter: AuditFilter;
  options: FilterOption[];
  onFilter: (f: AuditFilter) => void;
  onJump: (index: number) => void;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 flex flex-col gap-5 rounded-xl border border-line-strong bg-surface-2/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {"// controls"}
        </p>

        <div>
          <p className="kicker px-1">show</p>
          <div className="mt-2">
            <FilterControl
              options={options}
              value={filter}
              onChange={onFilter}
              variant="rail"
            />
          </div>
        </div>

        {model.worstSections.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="kicker px-1">weakest sections</p>
            <ol className="mt-2 flex flex-col gap-0.5">
              {model.worstSections.map((s, rank) => (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => onJump(s.index)}
                    className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-1/70"
                  >
                    <span className="w-3 shrink-0 font-mono text-[11px] text-ink-faint tabular-nums">
                      {rank + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted transition-colors group-hover:text-ink">
                      {s.label}
                    </span>
                    <SegBar
                      sourced={s.metrics.sourced}
                      noteOnly={s.metrics.noteOnly}
                      unsourced={s.metrics.unsourced}
                      className="h-1 w-12"
                    />
                    <span className="w-8 text-right font-mono text-[11px] text-ink-muted tabular-nums">
                      {Math.round(s.metrics.coverage * 100)}%
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="border-t border-line pt-4">
          <p className="kicker px-1">legend</p>
          <ul className="mt-2 flex flex-col gap-1.5 px-1 text-[12px] text-ink-muted">
            <LegendItem className="bg-success">inline citation</LegendItem>
            <LegendItem className="bg-warn">note only, no source</LegendItem>
            <LegendItem className="bg-danger/80">no inline citation</LegendItem>
          </ul>
        </div>
      </div>
    </aside>
  );
}

function LegendItem({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${className}`}
        aria-hidden="true"
      />
      {children}
    </li>
  );
}
