import { CaseExplorer } from "@/components/CaseExplorer";
import { LiveTrace } from "@/components/LiveTrace";
import { Hero } from "@/components/site/Hero";
import { Masthead } from "@/components/site/Masthead";
import { Method } from "@/components/site/Method";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function Home() {
  return (
    <>
      <Masthead />
      <main className="flex flex-col">
        <Hero />
        <Method />

        {/* The cases — a sunken band to set the dossiers apart. */}
        <section
          id="cases"
          className="scroll-mt-16 border-y border-line bg-surface-1/45"
        >
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="kicker">{"// the cases"}</p>
                <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.015em] text-ink sm:text-[2.5rem]">
                  Three real case files.
                </h2>
              </div>
              <p className="max-w-sm text-[14px] leading-relaxed text-ink-muted">
                Each one traced by hand on the Wikipedia API. The easy ones are
                boring — these evolved. Open one and read the story down to the
                revision.
              </p>
            </div>
            <div className="mt-12">
              <CaseExplorer />
            </div>
          </div>
        </section>

        {/* Live explorer. */}
        <section id="live" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="kicker">{"// live"}</p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium tracking-[-0.015em] text-ink sm:text-[2.5rem]">
              Interrogate a claim{" "}
              <span className="text-accent">yourself</span>.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
              The same engine, live: point it at an article and a phrase, and it
              binary-searches the real history down to the revision that
              introduced the claim.
            </p>
            <div className="mt-10">
              <LiveTrace />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
