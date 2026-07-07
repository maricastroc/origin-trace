import type { TimelineEvent } from "@/types/TimelineEvent";
import { TimelineRow } from "./TimelineRow";

export function Timeline({
  events,
  label,
  subtitle,
}: {
  events: TimelineEvent[];
  label: string;
  subtitle: string;
}) {
  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4 border-t border-line pt-5">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
            {label}
          </h3>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-faint">
            {subtitle}
          </p>
        </div>
        <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint sm:block">
          {events.length} nodes
        </span>
      </div>
      <ol>
        {events.map((event, i) => (
          <TimelineRow
            key={event.id}
            event={event}
            isLast={i === events.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}
