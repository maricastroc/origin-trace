import { ArrowRightIcon } from "./icons";

interface CircularLoopProps {
  loop: {
    cycle: { actor: string; year: number; action: string }[];
    note: string;
  };
}

export function CircularLoop({ loop }: CircularLoopProps) {
  return (
    <section className="rounded-xl bg-danger-bg px-5 py-4">
      <h2 className="mb-2.5 text-[13px] font-medium text-danger">
        O laço circular (citogênese)
      </h2>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {loop.cycle.map((step, i) => (
          <div
            key={`${step.actor}-${step.year}`}
            className="flex items-center gap-2"
          >
            <span className="rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-danger">
              {step.actor} {step.year} · {step.action}
            </span>
            {i < loop.cycle.length - 1 && (
              <ArrowRightIcon className="h-3.5 w-3.5 text-danger" />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-danger">{loop.note}</p>
    </section>
  );
}
