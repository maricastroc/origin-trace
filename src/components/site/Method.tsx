/** The reconstruction pipeline — the mechanism, made legible. */
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
    title: "Read the whole history",
    detail:
      "Every revision, oldest to newest. Finite and enumerable — a closed corpus.",
    stat: { value: "1,690", unit: "revisions · Quokka, in full" },
  },
  {
    n: "04",
    title: "Locate the origin",
    detail:
      "Binary-search the history down to the exact revision the claim first appeared.",
  },
  {
    n: "05",
    title: "Classify the evidence",
    detail: "Born-sourced, retrofit, unsourced — each verdict pinned to revision ids.",
  },
];

/** Why the verdict can be trusted — the properties that fall out of the method. */
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
    body: "An article's revision history is finite and enumerable. “I read everything” is provable — so “unsourced until 2019” is a proven fact, not an “I didn't find it.” Abstention becomes trustworthy.",
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

        {/* Why it's hard — reframes the whole thing before the mechanism. */}
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

        {/* The pipeline — the mechanism most visitors never see. */}
        <div className="mt-14">
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Every verdict is reconstructed from the article&rsquo;s{" "}
            <span className="text-ink">entire revision history</span> — read in
            full, never inferred by an LLM.
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
                      <span className={accent ? "text-accent" : "text-ink-faint"}>
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
                        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                          {s.stat.unit}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Flow arrows: rightward between columns, downward when stacked. */}
                  {!last && (
                    <>
                      <span
                        className="absolute -right-[9px] top-2 hidden font-mono text-[13px] text-line-strong sm:block"
                        aria-hidden="true"
                      >
                        →
                      </span>
                      <span
                        className="mt-3 block text-center font-mono text-[13px] text-line-strong sm:hidden"
                        aria-hidden="true"
                      >
                        ↓
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Why the verdict holds — the trust properties. */}
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
