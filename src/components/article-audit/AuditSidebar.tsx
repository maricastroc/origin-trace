import type { AuditFilter, AuditSort } from "@/lib/auditMetrics";
import { FilterControl, type ControlOption } from "./FilterControl";
import { STATUS_META } from "./statusMeta";

export function AuditSidebar({
  panelRef,
  filter,
  filterOptions,
  onFilter,
  sort,
  sortOptions,
  onSort,
}: {
  panelRef?: React.Ref<HTMLDivElement>;
  filter: AuditFilter;
  filterOptions: ControlOption<AuditFilter>[];
  onFilter: (f: AuditFilter) => void;
  sort: AuditSort;
  sortOptions: ControlOption<AuditSort>[];
  onSort: (s: AuditSort) => void;
}) {
  return (
    <aside className="hidden lg:block">
      <div
        ref={panelRef}
        className="flex flex-col gap-5 rounded-xl border border-line-strong bg-surface-2/40 p-4"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {"// controls"}
        </p>

        <div>
          <p className="kicker px-1">show</p>
          <div className="mt-2">
            <FilterControl
              options={filterOptions}
              value={filter}
              onChange={onFilter}
              variant="rail"
            />
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <p className="kicker px-1">sort sections</p>
          <div className="mt-2">
            <FilterControl
              options={sortOptions}
              value={sort}
              onChange={onSort}
              variant="rail"
            />
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <p className="kicker px-1">legend</p>
          <ul className="mt-2 flex flex-col gap-1.5 px-1 text-[12px] text-ink-muted">
            <LegendItem status="sourced">inline citation</LegendItem>
            <LegendItem status="note-only">note only, no source</LegendItem>
            <LegendItem status="unsourced">no inline citation</LegendItem>
          </ul>
        </div>
      </div>
    </aside>
  );
}

function LegendItem({
  status,
  children,
}: {
  status: keyof typeof STATUS_META;
  children: React.ReactNode;
}) {
  const { Icon, className } = STATUS_META[status];
  return (
    <li className="flex items-center gap-2">
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${className}`}
        aria-hidden="true"
      />
      {children}
    </li>
  );
}
