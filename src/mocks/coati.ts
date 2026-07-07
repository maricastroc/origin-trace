import type { ClaimProvenance } from "@/types/ClaimProvenance";

export const coati: ClaimProvenance = {
  claim: {
    text: "The coati is also known as the 'Brazilian aardvark'.",
    article: "Coati",
    articleUrl: "https://en.wikipedia.org/wiki/Coati",
    lang: "en",
  },
  verdict: {
    primary: "retrofit",
    confidence: "high",
    summary: "Born unsourced; the citation backing it came from itself.",
  },
  timeline: [
    {
      id: "e0",
      date: "2008-08",
      kind: "claim-introduced",
      wording: "also known as… Brazilian Aardvark",
      source: null,
      revId: 229827595,
      note: "added by an anonymous user, as a joke",
    },
    {
      id: "e1",
      date: "~2013",
      kind: "source-added",
      wording: "also known as Brazilian aardvarks",
      source: {
        label: "The Telegraph",
        year: 2010,
        type: "newspaper",
        note: "took the term from this very article (2008)",
      },
      revId: 557100001,
      transition: {
        changes: ["evidence-changed"],
        magnitude: "minor",
        note: "citation stuck on ~5 years later",
      },
    },
    {
      id: "e2",
      date: "2014",
      kind: "removed",
      note: "exposed as fabrication and removed from the article",
    },
  ],
  credibilityRead:
    "The citation looks like backing, but the source (Telegraph, 2010) took the term from this very article (2008). The “evidence” is the claim itself coming back dressed as a newspaper — zero independent evidence.",
  annotations: {
    circularLoop: {
      cycle: [
        { actor: "Wikipedia", year: 2008, action: "invents" },
        { actor: "Telegraph", year: 2010, action: "repeats" },
        { actor: "Wikipedia", year: 2013, action: "cites it back" },
      ],
      note: "The source took the term from this very article — zero independent evidence.",
    },
    unsourcedGap: {
      note: "~5 years presented as fact, with no source at all",
    },
  },
  meta: {
    generatedBy: "manual-trace",
    notes:
      "confirmed by directly reading the wikitext of revisions 229827595 (2008, unsourced) and 557100001 (2013, cites the Telegraph)",
  },
};
