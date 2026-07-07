import type { ClaimProvenance } from "@/types/ClaimProvenance";

export const butterbur: ClaimProvenance = {
  claim: {
    text: "Butterbur extracts may contain harmful pyrrolizidine alkaloids if not carefully purified.",
    article: "Petasites",
    articleUrl: "https://en.wikipedia.org/wiki/Petasites",
    lang: "en",
  },
  verdict: {
    primary: "ambiguous",
    confidence: "medium",
    summary:
      "Ambiguous by design — it depends on what counts as “the same claim.”",
    readings: [
      {
        lens: "as the continuous fact",
        verdict: "retrofit",
        reason:
          "The fact about alkaloids has existed since 2009, started unsourced, and the citation was swapped (Fu 2002 → Sun-Edelstein).",
      },
      {
        lens: "as the exact current sentence",
        verdict: "born-sourced",
        reason:
          "The current wording and the Sun-Edelstein citation were born together in the 2014 rewrite.",
      },
    ],
  },
  timeline: [
    {
      id: "e0",
      date: "2009",
      kind: "claim-introduced",
      wording: "extracts are available in which the alkaloids have been removed",
      source: null,
      revId: 322775877,
    },
    {
      id: "e1",
      date: "2013",
      kind: "source-added",
      wording: "contains alkaloids… toxic to the liver and may cause cancers",
      source: { label: "Fu et al.", year: 2002, type: "peer-reviewed" },
      revId: 540098344,
      transition: {
        changes: ["reframed"],
        magnitude: "major",
        note: "“were removed” → “contains”",
      },
    },
    {
      id: "e2",
      date: "2014",
      kind: "current",
      wording:
        "may contain harmful components… if not carefully and fully purified",
      source: {
        label: "Sun-Edelstein",
        type: "peer-reviewed",
        note: "review",
      },
      revId: 637695600,
      transition: {
        changes: ["reworded", "evidence-changed"],
        magnitude: "major",
        note: "“is toxic” → “may contain, if not purified”",
      },
    },
  ],
  credibilityRead:
    "The wording and the evidence changed several times. The boundary “what counts as the same claim?” is yours — the product shows both readings and the evolution that separates them.",
  meta: {
    generatedBy: "manual-trace",
    notes:
      "windows bracketed by content reading; exact revid of the 2014 rewrite not pinned",
  },
};
