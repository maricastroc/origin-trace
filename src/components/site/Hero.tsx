import { ArrowRight } from "lucide-react";
import { HeroSpecimen } from "./HeroSpecimen";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="kicker">{"// claim provenance, traced"}</p>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted">
            Wikipedia gives you the <span className="text-ink">claim</span>.
            Origin Trace gives you its{" "}
            <span className="text-ink">provenance</span>.
          </p>

          <h1 className="mt-3 font-display text-[2.75rem] font-medium leading-[1.02] tracking-[-0.02em] text-ink sm:text-6xl">
            Where did this
            <br />
            <span className="text-accent">claim</span> come from?
            <span className="cursor ml-1.5 align-baseline" aria-hidden="true" />
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-muted sm:text-base">
            Origin Trace reconstructs the{" "}
            <span className="text-ink">
              genealogy of a claim&rsquo;s credibility
            </span>{" "}
            — when it entered, whether it was born with a source, when the
            evidence changed — down to the exact revision. When the record
            doesn&rsquo;t back it up, it{" "}
            <span className="text-ink">says so</span>, instead of inventing a
            provenance.
          </p>

          <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            <span className="text-accent" aria-hidden="true">
              ▪
            </span>
            <span>reads every revision</span>
            <span className="text-line-strong" aria-hidden="true">
              /
            </span>
            <span>binary-searches the origin</span>
            <span className="text-line-strong" aria-hidden="true">
              /
            </span>
            <span className="text-ink-muted">never an LLM</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#cases"
              className="group inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-strong"
            >
              Open a case
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
            <a
              href="#method"
              className="inline-flex items-center rounded-md border border-line-strong bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              The method
            </a>
          </div>
        </div>

        <div className="lg:pl-4">
          <HeroSpecimen />
        </div>
      </div>

      <div
        className="mx-auto h-px w-full max-w-5xl bg-line px-5 sm:px-8"
        aria-hidden="true"
      />
    </section>
  );
}
