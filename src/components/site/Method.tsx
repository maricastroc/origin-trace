import { ArrowDown, ArrowRight } from "lucide-react";

const PIPELINE: {
  n: string;
  title: string;
  detail: string;
  stat?: { value: string; unit: string };
}[] = [
  {
    n: "01",
    title: "The claim",
    detail: "A sentence you can read in the article today.",
  },
  {
    n: "02",
    title: "Resolve the article",
    detail:
      "Which page carries it — or, when it’s ambiguous, the candidates to choose from.",
  },
  {
    n: "03",
    title: "Enumerate the history",
    detail:
      "List every revision, oldest to newest — finite and enumerable, a closed corpus. That closure is what makes silence provable.",
    stat: { value: "1,690", unit: "revisions · Quokka, enumerated" },
  },
  {
    n: "04",
    title: "Locate the origin",
    detail:
      "Sample, then bisect — reading only what it needs — to the earliest occurrence it can confirm, and it flags when a sparse earlier one can't be ruled out.",
  },
  {
    n: "05",
    title: "Classify the evidence",
    detail:
      "Born-sourced, retrofit, unsourced — each verdict pinned to revision ids.",
  },
];

const PILLARS = [
  {
    n: "01",
    kicker: "genealogy",
    title: "Genealogy, not parallel",
    body: "An LLM summarizes evidence by treating sources as independent. But belief doesn't spread in parallel — it spreads genetically. Origin Trace reconstructs the chain: who cited whom, and where the root is weak.",
  },
  {
    n: "02",
    kicker: "closed corpus",
    title: "Silence is provable",
    body: "An article's revision history is finite and enumerable — a closed corpus. When the search reads every revision below an origin, “unsourced until 2019” is a proof about the whole history, not an “I didn't find it” — and when it only samples that range, it says so rather than overclaiming. Abstention becomes trustworthy.",
  },
  {
    n: "03",
    kicker: "honesty",
    title: "It admits when the record is silent",
    body: "When the wording shifts and the verdict depends on where you draw the line, the tool shows both readings and hands the judgment back to you — instead of inventing a certainty the history doesn't support.",
  },
];

export function Method() {
  return (
    <section id="method" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="kicker">{"// the method"}</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-[1.08] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          From a claim you read to the{" "}
          <span className="text-accent">genealogy</span> that holds it up.
        </h2>

        <div className="mt-8 max-w-2xl border-l-2 border-accent pl-4 sm:pl-5">
          <p className="font-voice text-[20px] italic leading-snug text-ink sm:text-[22px]">
            Wikipedia stores the current article. It doesn&rsquo;t store the
            story of how a claim earned its evidence.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            The citation you see today says nothing about whether the claim was
            born with it — or whether a source was bolted on, years later, to
            launder an assertion that was never backed. That story lives only in
            the revision history. So Origin Trace reads the revision history.
          </p>
        </div>

        <div className="mt-14">
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Every verdict is reconstructed from the article&rsquo;s{" "}
            <span className="text-ink">revision history</span> — read as
            wikitext and diffed revision to revision. Deterministic string work,
            not a model&rsquo;s guess.
          </p>

          <ol className="mt-8 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-5">
            {PIPELINE.map((s, i) => {
              const accent = Boolean(s.stat);
              const last = i === PIPELINE.length - 1;
              return (
                <li key={s.n} className="relative flex h-full flex-col">
                  <div
                    className={`flex h-full flex-col border-t-2 pt-3.5 ${
                      accent ? "border-accent" : "border-ink"
                    }`}
                  >
                    <span className="font-mono text-[12px]">
                      <span
                        className={accent ? "text-accent" : "text-ink-faint"}
                      >
                        {s.n}
                      </span>
                    </span>
                    <h3 className="mt-2 text-[14.5px] font-semibold tracking-tight text-ink">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                      {s.detail}
                    </p>
                    {s.stat && (
                      <div className="mt-auto pt-3">
                        <span className="font-display text-[27px] leading-none text-accent">
                          {s.stat.value}
                        </span>
                        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-widest text-ink-faint">
                          {s.stat.unit}
                        </p>
                      </div>
                    )}
                  </div>

                  {!last && (
                    <>
                      <ArrowRight
                        className="absolute -right-2.75 top-1.5 hidden h-3.5 w-3.5 text-line-strong sm:block"
                        aria-hidden="true"
                      />
                      <ArrowDown
                        className="mx-auto mt-3 block h-3.5 w-3.5 text-line-strong sm:hidden"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-12 max-w-2xl border-l-2 border-accent pl-4 sm:pl-5">
          <p className="font-voice text-[18px] italic leading-snug text-ink sm:text-[20px]">
            The hard case: a claim&rsquo;s presence isn&rsquo;t monotonic. It
            can be added, removed, and re-added across an article&rsquo;s life.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            A plain binary search would cave here — landing on whichever
            add-or-remove edge it happened to hit. So the search never trusts
            the first occurrence it finds: it re-scans earlier revisions for an
            older origin, and when the true birth may predate what it actually
            read — a re-addition, or a sparse island below the sampled range —
            it lowers its own confidence and says so, instead of pinning a false
            date.
          </p>
        </div>

        <div className="mt-16">
          <p className="kicker">{"// why the verdict holds"}</p>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            It&rsquo;s not a fact-checker: it doesn&rsquo;t say “true” or
            “false.” It says where a claim&rsquo;s backing came from, and how
            solid it is — all auditable down to the exact revision.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-3">
            {PILLARS.map((s) => (
              <div key={s.n} className="border-t-2 border-ink pt-4">
                <p className="font-mono text-[13px] text-ink-faint">
                  <span className="text-accent">{s.n}</span> · {s.kicker}
                </p>
                <h3 className="mt-3 text-[17px] font-semibold tracking-tight text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
