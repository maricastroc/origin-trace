import type { AuditFilter } from "@/lib/auditMetrics";

export interface FilterOption {
  key: AuditFilter;
  label: string;
  count: number;
  dot?: string;
}

function Dot({ className }: { className: string }) {
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${className}`}
      aria-hidden="true"
    />
  );
}

export function FilterControl({
  options,
  value,
  onChange,
  variant,
}: {
  options: FilterOption[];
  value: AuditFilter;
  onChange: (f: AuditFilter) => void;
  variant: "rail" | "pills";
}) {
  if (variant === "pills") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                active
                  ? "border-ink bg-ink text-[color:var(--paper-raised)]"
                  : "border-line-strong text-ink-muted hover:border-ink hover:text-ink"
              }`}
            >
              {o.dot && !active && <Dot className={o.dot} />}
              {o.label}
              <span className="font-mono text-[10.5px] tabular-nums opacity-70">
                {o.count}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
              active
                ? "bg-surface-2 text-ink"
                : "text-ink-muted hover:bg-surface-1/70 hover:text-ink"
            }`}
          >
            {o.dot ? (
              <Dot className={o.dot} />
            ) : (
              <span className="h-1.5 w-1.5 shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1">{o.label}</span>
            <span className="font-mono text-[11px] text-ink-faint tabular-nums">
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
