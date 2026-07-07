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
    summary: "Nasceu sem fonte; a citação que a respalda saiu dela mesma.",
  },
  timeline: [
    {
      id: "e0",
      date: "2008-08",
      kind: "claim-introduced",
      wording: "also known as… Brazilian Aardvark",
      source: null,
      revId: 229827595,
      note: "adicionada por um usuário anônimo, como brincadeira",
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
        note: "pegou o termo deste mesmo artigo (2008)",
      },
      revId: 557100001,
      transition: {
        changes: ["evidence-changed"],
        magnitude: "minor",
        note: "citação grudada ~5 anos depois",
      },
    },
    {
      id: "e2",
      date: "2014",
      kind: "removed",
      note: "exposta como invenção e removida do artigo",
    },
  ],
  credibilityRead:
    "A citação parece dar respaldo, mas a fonte (Telegraph, 2010) tirou o termo deste mesmo artigo (2008). A 'evidência' é a própria afirmação voltando disfarçada de jornal — zero evidência independente.",
  annotations: {
    circularLoop: {
      cycle: [
        { actor: "Wikipedia", year: 2008, action: "inventa" },
        { actor: "Telegraph", year: 2010, action: "repete" },
        { actor: "Wikipedia", year: 2013, action: "cita de volta" },
      ],
      note: "A fonte tirou o termo deste mesmo artigo — zero evidência independente.",
    },
    unsourcedGap: {
      note: "~5 anos apresentada como fato, sem nenhuma fonte",
    },
  },
  meta: {
    generatedBy: "manual-trace",
    notes:
      "confirmado por leitura direta do wikitext das revisões 229827595 (2008, sem fonte) e 557100001 (2013, cita o Telegraph)",
  },
};
