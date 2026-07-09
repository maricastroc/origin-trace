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
  const { rows } = events.reduce<{
    rows: { event: TimelineEvent; unchangedSince: string | undefined }[];
    lastWording: string | undefined;
    lastWordingDate: string | undefined;
  }>(
    (acc, event) => {
      if (event.wording == null) {
        acc.rows.push({ event, unchangedSince: undefined });
      } else if (event.wording === acc.lastWording) {
        acc.rows.push({ event, unchangedSince: acc.lastWordingDate });
      } else {
        acc.rows.push({ event, unchangedSince: undefined });
        acc.lastWording = event.wording;
        acc.lastWordingDate = event.date;
      }
      return acc;
    },
    { rows: [], lastWording: undefined, lastWordingDate: undefined },
  );

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
        <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-widest text-ink-faint sm:block">
          {events.length} nodes
        </span>
      </div>
      <ol>
        {rows.map(({ event, unchangedSince }, i) => (
          <TimelineRow
            key={event.id}
            event={event}
            isLast={i === events.length - 1}
            unchangedSince={unchangedSince}
          />
        ))}
      </ol>
    </section>
  );
}
