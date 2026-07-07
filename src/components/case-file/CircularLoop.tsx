import { ArrowRightIcon } from "./icons";

interface CircularLoopProps {
  loop: {
    cycle: { actor: string; year: number; action: string }[];
    note: string;
  };
}

export function CircularLoop({ loop }: CircularLoopProps) {
  return (
    <section className="rounded-xl border border-danger/25 bg-danger-bg px-5 py-4">
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
        ⟳ the circular loop · citogenesis
      </h3>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {loop.cycle.map((step, i) => (
          <div
            key={`${step.actor}-${step.year}`}
            className="flex items-center gap-2"
          >
            <span className="rounded-md border border-danger/25 bg-surface-2 px-2.5 py-1 text-[12.5px] text-ink">
              <span className="font-medium text-danger">{step.actor}</span>{" "}
              <span className="font-mono text-[11px] text-ink-muted">
                {step.year}
              </span>{" "}
              · {step.action}
            </span>
            {i < loop.cycle.length - 1 && (
              <ArrowRightIcon className="h-3.5 w-3.5 text-danger/60" />
            )}
          </div>
        ))}
      </div>
      <p className="text-[13.5px] leading-relaxed text-danger">{loop.note}</p>
    </section>
  );
}
