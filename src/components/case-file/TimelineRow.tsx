import type { TimelineEvent } from "@/types/TimelineEvent";
import { eventKindLabel } from "@/lib/eventKindLabel";
import { SourceChip } from "./SourceChip";
import { TransitionLabel } from "./TransitionLabel";
import { UnlinkIcon } from "./icons";

function nodeClass(event: TimelineEvent): string {
  if (event.kind === "claim-absent") {
    return "border-line-strong bg-surface-2";
  }
  if (event.source === null) {
    return "border-danger bg-danger";
  }
  if (event.kind === "current") {
    return "border-ink bg-ink ring-2 ring-line-strong ring-offset-2 ring-offset-[color:var(--paper-raised)]";
  }
  if (event.kind === "removed") return "border-ink bg-surface-2";
  return "border-ink-muted bg-ink-muted";
}

export function TimelineRow({
  event,
  isLast,
  unchangedSince,
}: {
  event: TimelineEvent;
  isLast: boolean;
  /** When set, this node's wording is a verbatim repeat first seen on this date —
   *  render a compact "unchanged since …" line instead of reprinting the quote. */
  unchangedSince?: string;
}) {
  return (
    <li className="relative pb-9 pl-9 last:pb-0">
      {!isLast && (
        <span
          className="absolute left-[7px] top-3 h-full w-[2px] bg-line-strong"
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 ${nodeClass(event)}`}
        aria-hidden="true"
      />

      {event.transition && <TransitionLabel transition={event.transition} />}

      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-mono text-[13px] font-semibold tracking-tight text-ink">
          {event.date}
        </span>
        <span className="text-[13px] text-ink-muted">
          {eventKindLabel[event.kind]}
        </span>
        {event.revId && (
          <a
            href={`https://en.wikipedia.org/w/index.php?oldid=${event.revId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-ink-faint underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent"
          >
            rev {event.revId}
          </a>
        )}
      </div>

      {event.wording &&
        (unchangedSince ? (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[12px] text-ink-faint">
            <span aria-hidden="true" className="text-ink-muted">
              &#8618;
            </span>
            same wording since {unchangedSince} &mdash; never reworded
          </p>
        ) : (
          <p className="mt-2 border-l-2 border-line pl-3 font-voice text-[15px] italic leading-relaxed text-ink-muted">
            &ldquo;{event.wording}&rdquo;
          </p>
        ))}

      {event.note && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {event.note}
        </p>
      )}

      {event.source === null ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger-bg px-2.5 py-1.5 text-[12.5px] font-medium text-danger">
            <UnlinkIcon className="h-4 w-4" />
            no source
          </span>
          {event.hasExplanatoryNote && (
            <span
              className="rounded-md border border-line-strong bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-muted"
              title="An explanatory footnote ([α]-style) sits on the claim, but it cites no source."
            >
              explanatory note only
            </span>
          )}
        </div>
      ) : event.source ? (
        <div className="mt-3">
          <SourceChip source={event.source} />
        </div>
      ) : null}
    </li>
  );
}
