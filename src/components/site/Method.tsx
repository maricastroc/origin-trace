const STEPS = [
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
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          It&rsquo;s not a fact-checker: it doesn&rsquo;t say “true” or “false.”
          It says where a claim&rsquo;s backing came from, and how solid it is —
          all auditable down to the exact revision.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-3">
          {STEPS.map((s) => (
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
    </section>
  );
}
