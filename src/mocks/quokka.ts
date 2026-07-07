import type { ClaimProvenance } from "@/types/ClaimProvenance";

export const quokka: ClaimProvenance = {
  claim: {
    text: "The quokka is the world's happiest animal.",
    article: "Quokka",
    articleUrl: "https://en.wikipedia.org/wiki/Quokka",
    lang: "en",
  },
  verdict: {
    primary: "churn",
    confidence: "medium",
    summary: "Always sourced, but the evidence spun 3× — all popular media.",
  },
  timeline: [
    {
      id: "e0",
      date: "2005",
      kind: "claim-absent",
      note: "the claim does not exist in the article yet",
    },
    {
      id: "e1",
      date: "2016-07",
      kind: "claim-introduced",
      wording: "…called 'the happiest animal in the world'",
      source: { label: "HuffPost", year: 2013, type: "popular-media" },
      revId: 729272914,
    },
    {
      id: "e2",
      date: "2019-05",
      kind: "source-replaced",
      wording: "reputation of the happiest animal on Earth",
      source: {
        label: "rove.me",
        year: 2019,
        type: "travel-site",
      },
      revId: 899704274,
      transition: {
        changes: ["reworded", "evidence-changed"],
        magnitude: "minor",
      },
    },
    {
      id: "e3",
      date: "2023",
      kind: "current",
      wording:
        "earned a reputation as 'the world's happiest animals' — they do not, in fact, smile",
      source: { label: "The West Australian", year: 2019, type: "newspaper" },
      transition: {
        changes: ["expanded", "evidence-changed"],
        magnitude: "major",
      },
    },
  ],
  credibilityRead:
    "Never unsourced, but the evidence was swapped 3× in 8 years, and all three sources are popular media, none primary. A 2013 meme wearing a 2019 newspaper citation.",
  sourceQuality: {
    note: "all three sources are popular media, none primary or scientific",
    flags: ["no-primary-source"],
  },
  meta: {
    generatedBy: "manual-trace",
    notes:
      "swaps bracketed by content reading; exact revids of the swaps not pinned",
  },
};
