import { ArticleAudit } from "@/components/article-audit/ArticleAudit";
import { Investigations } from "@/components/investigations/Investigations";
import { LiveTrace } from "@/components/live-trace/LiveTrace";
import { Hero } from "@/components/site/Hero";
import { Masthead } from "@/components/site/Masthead";
import { Method } from "@/components/site/Method";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Taxonomy } from "@/components/site/Taxonomy";

export default function Home() {
  return (
    <>
      <Masthead />
      <main className="flex flex-col">
        <Hero />
        <Method />
        <Taxonomy />

        <section
          id="cases"
          className="scroll-mt-16 border-y border-line bg-surface-1/45"
        >
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="kicker">{"// investigations"}</p>
                <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.015em] text-ink sm:text-[2.5rem]">
                  Investigations.
                </h2>
              </div>
              <p className="max-w-sm text-[14px] leading-relaxed text-ink-muted">
                A curated file of what the engine can catch — citogenesis,
                retrofit, unsourced-stable claims. Every verdict is real engine
                output, pinned and reproducible. Hit{" "}
                <span className="text-ink">verify live</span> on any of them.
              </p>
            </div>
            <div className="mt-12">
              <Investigations />
            </div>
          </div>
        </section>

        <section id="live" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="kicker">{"// live"}</p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium tracking-[-0.015em] text-ink sm:text-[2.5rem]">
              Interrogate a claim <span className="text-accent">yourself</span>.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
              Paste a claim. Origin Trace tries to resolve which article it
              belongs to — and when the scope is ambiguous, it shows you the
              candidates instead of guessing. Then it binary-searches that
              article&rsquo;s real history down to the revision that introduced
              the claim.
            </p>
            <div className="mt-10">
              <LiveTrace />
            </div>
          </div>
        </section>

        <section
          id="audit"
          className="scroll-mt-16 border-t border-line bg-surface-1/45"
        >
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="kicker">{"// audit"}</p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium tracking-[-0.015em] text-ink sm:text-[2.5rem]">
              Or audit a whole <span className="text-accent">article</span>.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
              One read of the current revision maps every sentence to its
              evidence: which carry an inline citation, which assert without
              one. The claim boundary comes free from Wikipedia&rsquo;s own
              structure — no NLP. Then click any uncited sentence to trace its
              history down to the revision that introduced it.
            </p>
            <div className="mt-10">
              <ArticleAudit />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
