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
  // A node whose wording is a verbatim repeat of the last one we already showed
  // isn't new information — it's the same sentence, still alive. Rather than
  // reprint it (which reads as "wait, didn't I just see this?"), we hand the row
  // the date the wording first appeared so it can collapse to "unchanged since …".
  let lastWording: string | undefined;
  let lastWordingDate: string | undefined;
  const rows = events.map((event) => {
    let unchangedSince: string | undefined;
    if (event.wording != null) {
      if (event.wording === lastWording) {
        unchangedSince = lastWordingDate;
      } else {
        lastWording = event.wording;
        lastWordingDate = event.date;
      }
    }
    return { event, unchangedSince };
  });

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
