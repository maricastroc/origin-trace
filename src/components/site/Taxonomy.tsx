import type { Verdict } from "@/types/Verdict";
import { verdictStyle } from "@/lib/verdictStyle";

// `removed` is a terminal state surfaced on the case file, not one of the
// evidence-life *patterns* this vocabulary teaches — keep it out of the section.
const VERDICTS = (Object.keys(verdictStyle) as Verdict[]).filter((v) => v !== "removed");

export function Taxonomy() {
  const ordered = [...VERDICTS].sort(
    (a, b) => verdictStyle[a].rank - verdictStyle[b].rank,
  );
  return (
    <section id="patterns" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8 sm:pb-24">
        <p className="kicker">{"// the vocabulary"}</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          It doesn&rsquo;t say true or false. It{" "}
          <span className="text-accent">classifies</span> the evidence history.
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          Every claim resolves to one of these patterns — a read on the life of
          its evidence, not a fact-check of its content.
        </p>

        <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((v) => {
            const s = verdictStyle[v];
            return (
              <li
                key={v}
                className="flex gap-3 border-t border-line pt-4"
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`}
                  aria-hidden="true"
                />
                <div>
                  <p className="flex items-baseline gap-2">
                    <span className="font-mono text-[13px] text-ink">
                      {s.label}
                    </span>
                    <span className={`font-mono text-[11px] ${s.ink}`}>
                      {s.health}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                    {s.gloss}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
