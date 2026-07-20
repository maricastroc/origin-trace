import type { GenealogyTrace } from "@/types/GenealogyTrace";
import { wordDiff } from "@/lib/wordDiff";

/**
 * The reformulation chain — the case file's second algorithm made visible. Where
 * the descent shows the search finding *where* a claim began, this shows *how its
 * wording drifted* on the way there: each revision's wording is diffed against
 * the one before it, and the anchors that survived the rewording are lit up as
 * the invariant idea the walk actually followed. It's the LCS-diff genealogy,
 * legible — a picture of why the trace could follow a claim past a paraphrase
 * that a plain string search would have lost.
 */

const core = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const RESIDUAL: Record<
  GenealogyTrace["residual"],
  { label: string; tone: string; gloss: string }
> = {
  resolved: {
    label: "clean origin",
    tone: "text-success",
    gloss: "The walk reached a first insertion it could confirm.",
  },
  "more-determinism": {
    label: "structured genesis",
    tone: "text-warn",
    gloss:
      "The trail runs into a table or template — reachable with more determinism, not guessed at.",
  },
  semantic: {
    label: "semantic wall",
    tone: "text-warn",
    gloss:
      "The wording drifted too far to follow by anchors alone; an earlier form likely exists but isn’t confirmed here.",
  },
  unrecoverable: {
    label: "no anchors",
    tone: "text-ink-faint",
    gloss: "Nothing stable enough to follow further back.",
  },
};

function formatAnchors(anchors: string[]): string {
  if (anchors.length <= 3) return anchors.join(", ");
  return `${anchors.slice(0, 3).join(", ")} +${anchors.length - 3}`;
}

export function GenealogyChain({ genealogy }: { genealogy: GenealogyTrace }) {
  const { steps, terminus, residual, movedEarlier } = genealogy;
  if (steps.length < 2) return null;

  const rewordings = steps.length - 1;
  const r = RESIDUAL[residual];
  const origin = steps[0];
  const latest = steps[steps.length - 1];

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="kicker">the reformulation chain</p>
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-faint">
          {rewordings} rewording{rewordings === 1 ? "" : "s"}
          {movedEarlier ? " · moved the origin earlier" : ""}
        </p>
      </div>

      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {origin.date === latest.date
          ? `In ${origin.date} the wording changed ${rewordings}×.`
          : `Between ${origin.date} and ${latest.date} the wording changed ${rewordings}×.`}{" "}
        The <Anchor>highlighted</Anchor> words are the anchors — numbers and
        proper names — that carried across each rewording; they are the
        invariant the trace followed back, past paraphrases a plain string
        search would have lost.
      </p>

      <ol className="mt-5 space-y-1">
        {steps.map((s, k) => {
          const isLast = k === steps.length - 1;
          return (
            <li key={s.revId} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-accent ${s.sourced ? "bg-accent" : "bg-surface-2"}`}
                  aria-hidden="true"
                />
                {!isLast && (
                  <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
                )}
              </div>

              <div className="flex-1 pb-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[11px] text-ink">
                    {s.date}
                  </span>
                  {k === 0 && (
                    <span className="rounded-full border border-line-strong px-1.5 font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">
                      origin
                    </span>
                  )}
                  <span
                    className={`font-mono text-[10.5px] ${s.sourced ? "text-success" : "text-ink-faint"}`}
                  >
                    {s.sourced
                      ? `sourced${s.sourceLabel ? ` · ${s.sourceLabel}` : ""}`
                      : "unsourced"}
                  </span>
                </div>

                <p className="mt-1 text-[13.5px] leading-relaxed">
                  {k === 0 ? (
                    <span className="text-ink">{s.wording}</span>
                  ) : (
                    <Diff
                      prev={steps[k - 1].wording}
                      next={s.wording}
                      anchors={s.anchorsShared}
                    />
                  )}
                </p>

                {k >= 1 && (s.overlap !== undefined || s.anchorsShared.length > 0) && (
                  <p className="mt-1.5 font-mono text-[10.5px] text-ink-faint">
                    {s.overlap !== undefined
                      ? `≈${Math.round(s.overlap * 100)}% shared`
                      : ""}
                    {s.anchorsShared.length
                      ? `${s.overlap !== undefined ? " · " : ""}held ${formatAnchors(s.anchorsShared)}`
                      : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 font-mono text-[10.5px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <Anchor>held</Anchor> anchor held
        </span>
        <span className="text-accent">new wording</span>
        <span className="text-ink-ghost line-through decoration-ink-ghost/50">
          dropped
        </span>
        <span className="ml-auto inline-flex flex-wrap items-center gap-x-1.5">
          stopped at
          <code className="rounded border border-line-strong bg-surface-2 px-1 py-0.5 not-italic text-ink-muted">
            {terminus}
          </code>
          <span aria-hidden="true">·</span>
          <span className={r.tone}>{r.label}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
        {r.gloss}
      </p>
    </section>
  );
}

function Diff({
  prev,
  next,
  anchors,
}: {
  prev: string;
  next: string;
  anchors: string[];
}) {
  const anchorSet = new Set(anchors.map(core));
  return (
    <>
      {wordDiff(prev, next).map((t, i) => {
        if (t.op === "del")
          return (
            <del
              key={i}
              className="mx-0.5 text-ink-ghost line-through decoration-ink-ghost/50"
            >
              {t.text}
            </del>
          );
        if (t.op === "add")
          return (
            <span key={i} className="mx-0.5 text-accent">
              {t.text}
            </span>
          );
        return anchorSet.has(core(t.text)) ? (
          <Anchor key={i}>{t.text}</Anchor>
        ) : (
          <span key={i} className="mx-0.5 text-ink-muted">
            {t.text}
          </span>
        );
      })}
    </>
  );
}

function Anchor({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 rounded-[2px] bg-accent/10 text-ink underline decoration-accent/50 decoration-1 underline-offset-2">
      {children}
    </span>
  );
}
