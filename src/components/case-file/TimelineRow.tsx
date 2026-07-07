import type { TimelineEvent } from "@/types/TimelineEvent";
import { eventKindLabel } from "@/lib/eventKindLabel";
import { SourceChip } from "./SourceChip";
import { TransitionLabel } from "./TransitionLabel";
import { UnlinkIcon } from "./icons";

function dotClass(event: TimelineEvent): string {
  if (event.kind === "claim-absent") return "border-line-strong bg-surface-0";
  if (event.source === null) return "border-danger bg-danger";
  if (event.kind === "current" || event.kind === "removed")
    return "border-ink bg-ink";
  return "border-ink-muted bg-ink-muted";
}

export function TimelineRow({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  return (
    <li className="relative pb-6 pl-8 last:pb-0">
      {!isLast && (
        <span
          className="absolute left-[6.5px] top-2 h-full w-px bg-line"
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 ${dotClass(event)}`}
        aria-hidden="true"
      />
      <div>
        {event.transition && <TransitionLabel transition={event.transition} />}
        <p className="text-[13px] font-medium text-ink">
          {event.date} {eventKindLabel[event.kind]}
        </p>
        {event.wording && (
          <p className="mt-1.5 font-voice text-sm italic text-ink-muted">
            &ldquo;{event.wording}&rdquo;
          </p>
        )}
        {event.note && (
          <p className="mt-1.5 text-[13px] text-ink-muted">{event.note}</p>
        )}
        {event.source === null ? (
          <span className="mt-2 inline-flex items-center gap-2 rounded-md bg-danger-bg px-2.5 py-1.5 text-[13px] font-medium text-danger">
            <UnlinkIcon className="h-4 w-4" />
            sem fonte
          </span>
        ) : event.source ? (
          <div className="mt-2">
            <SourceChip source={event.source} />
          </div>
        ) : null}
      </div>
    </li>
  );
}
