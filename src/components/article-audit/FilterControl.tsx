import type { LucideIcon } from "lucide-react";

export interface ControlOption<T extends string> {
  key: T;
  label: string;
  count?: number;
  Icon?: LucideIcon;
  /** text-color class for the icon */
  iconClass?: string;
}

/** Back-compat alias for the filter call site. */
export type FilterOption = ControlOption<string>;

function Marker<T extends string>({ option }: { option: ControlOption<T> }) {
  if (!option.Icon) {
    return <span className="w-3.5 shrink-0" aria-hidden="true" />;
  }
  const { Icon } = option;
  return (
    <Icon
      className={`h-3.5 w-3.5 shrink-0 ${option.iconClass ?? "text-ink-faint"}`}
      aria-hidden="true"
    />
  );
}

export function FilterControl<T extends string>({
  options,
  value,
  onChange,
  variant,
}: {
  options: ControlOption<T>[];
  value: T;
  onChange: (v: T) => void;
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
              {!active && <Marker option={o} />}
              {o.label}
              {o.count !== undefined && (
                <span className="font-mono text-[10.5px] tabular-nums opacity-70">
                  {o.count}
                </span>
              )}
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
            <Marker option={o} />
            <span className="flex-1">{o.label}</span>
            {o.count !== undefined && (
              <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
