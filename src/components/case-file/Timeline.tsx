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
      <h2 className="text-xs font-medium tracking-wide text-ink">{label}</h2>
      <p className="mb-4 mt-0.5 text-xs text-ink-faint">{subtitle}</p>
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
