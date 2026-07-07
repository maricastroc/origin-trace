import type { InvestigationSeed } from "./types.ts";

// The editorial spine of the Investigations section. Each entry is a seed the
// engine can re-run live; the pinned verdict lives in snapshots.generated.ts,
// produced by `npm run investigations:build`. Curate here; never hand-author a
// verdict — if a case's real output isn't emblematic, cut it. (Cleopatra was
// cut: its {{sfn}} shortened-footnote style reads as ~1% inline-cited, an
// artifact of citation form, not genuine unsourcing.)

export const REGISTRY: InvestigationSeed[] = [
  {
    slug: "quokka-happiest",
    title: "The world's happiest animal",
    dek: "A meme cited to a newspaper that only ran the line years later.",
    phenomenon: "citogenesis",
    narrative:
      "The quokka's reputation as “the happiest animal” lived on Wikipedia as unsourced fact before any publication printed it. The citation that finally stuck — The West Australian — was published after the claim was already here, so it cannot be the origin. The reference points back at the article that made the claim: circular by construction.",
    seed: { kind: "trace", article: "Quokka", phrase: "happiest animal" },
  },
  {
    slug: "coati-aardvark",
    title: "The Brazilian aardvark",
    dek: "A hoax nickname that outlived its own debunking — still unsourced.",
    phenomenon: "unsourced-stable",
    narrative:
      "A student invented the coati's “Brazilian aardvark” nickname as a joke edit in 2008; newspapers repeated it, and the loop became the textbook case of citogenesis. What the engine reads in the article today is the quieter aftermath: the phrase is still there, still carrying no citation, never removed — presented as fact, never backed.",
    seed: { kind: "trace", article: "Coati", phrase: "Brazilian aardvark" },
  },
  {
    slug: "petasites-alkaloids",
    title: "The alkaloids came first",
    dek: "A safety-relevant warning, asserted before any source backed it.",
    phenomenon: "retrofit",
    narrative:
      "Butterbur (Petasites) carries a real toxicology warning — its pyrrolizidine alkaloids can damage the liver. On Wikipedia the warning was stated as fact first; the citation was attached only later. The claim happens to be true, but its backing is retroactive — exactly the pattern you'd want to catch when the stakes are medical.",
    seed: { kind: "trace", article: "Petasites", phrase: "pyrrolizidine alkaloids" },
  },
  {
    slug: "neymar-note",
    title: "A footnote that cites nothing",
    dek: "An “[α]” marker that reads like a reference — and backs nothing.",
    phenomenon: "note-not-source",
    narrative:
      "Neymar's article says he has scored 100 goals for three different clubs, followed by a small “[α]” marker. It looks like a citation — a real reader flagged the tool for “missing” it — but the marker is an explanatory footnote: it adds context and cites no source. The engine reads it for what it is and keeps the claim unsourced. A note is not backing.",
    seed: {
      kind: "trace",
      article: "Neymar",
      phrase: "100 goals",
      claimText: "scored 100 goals for three different clubs",
    },
  },
  {
    slug: "quokka-audit",
    title: "The whole quokka, mapped",
    dek: "Zoom out from the claim to the page: every sentence, sourced or not.",
    phenomenon: "coverage",
    narrative:
      "The happiest-animal line is one sentence. Auditing the full article in a single read shows it in context — roughly half the body sentences carry no inline citation. Uncited isn't a verdict here; it's the map that tells you where a deeper trace is worth running.",
    seed: { kind: "audit", article: "Quokka" },
  },
  {
    slug: "black-hole-audit",
    title: "A featured article, measured",
    dek: "Even Wikipedia's top tier leaves half its sentences without an inline cite.",
    phenomenon: "coverage",
    narrative:
      "Black hole is a featured article — the encyclopedia's highest quality tier. Its per-sentence coverage still lands near half, because citations legitimately cluster at the end of a paragraph rather than on every sentence. The control case: it shows what the coverage number measures, and what it deliberately does not.",
    seed: { kind: "audit", article: "Black hole" },
  },
];
