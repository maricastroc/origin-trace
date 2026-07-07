import { VerdictStamp } from "../case-file/VerdictStamp";

/** A showpiece case file for the hero — real Quokka provenance, at a glance. */
export function HeroSpecimen() {
  return (
    <div className="relative">
      {/* stacked-paper illusion behind the card */}
      <div
        className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl border border-line bg-surface-2/60"
        aria-hidden="true"
      />
      <div className="relative rounded-xl border border-line-strong bg-surface-2 p-6 shadow-[0_24px_50px_-30px_rgba(90,60,30,0.45)]">
        <div className="flex items-center justify-between">
          <span className="kicker">case · quokka</span>
          <span className="kicker">en.wikipedia</span>
        </div>

        <p className="mt-3 font-voice text-[22px] italic leading-snug text-ink">
          &ldquo;the world&rsquo;s happiest animal&rdquo;
        </p>

        <ol className="mt-6">
          <SpecimenNode
            tone="danger"
            date="2014"
            label="claim introduced · no source"
          />
          <SpecimenNode
            tone="muted"
            date="2019"
            label="reworded · source swapped"
          />
          <SpecimenNode
            tone="ink"
            date="today"
            label="The West Australian (2019)"
            last
          />
        </ol>

        <div className="mt-6 flex items-end justify-between border-t border-line pt-4">
          <span className="kicker leading-relaxed">
            75 / 1690 revisions read
            <br />
            binary search · closed corpus
          </span>
          <div className="-mb-1">
            <VerdictStamp verdict="retrofit" size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecimenNode({
  tone,
  date,
  label,
  last = false,
}: {
  tone: "danger" | "muted" | "ink";
  date: string;
  label: string;
  last?: boolean;
}) {
  const dot =
    tone === "danger"
      ? "border-danger bg-danger"
      : tone === "ink"
        ? "border-ink bg-ink ring-2 ring-line-strong ring-offset-2 ring-offset-[color:var(--paper-raised)]"
        : "border-line-strong bg-surface-1";
  return (
    <li className="relative flex gap-3.5 pb-4 last:pb-0">
      {!last && (
        <span
          className="absolute left-[6px] top-3 h-full w-px bg-line-strong"
          aria-hidden="true"
        />
      )}
      <span
        className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${dot}`}
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className="font-mono text-[11px] font-medium tracking-wide text-ink">
          {date}
        </span>
        <span className="text-[13px] text-ink-muted">{label}</span>
      </div>
    </li>
  );
}
