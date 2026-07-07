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
    summary: "Ambíguo por design — depende do que conta como 'a mesma afirmação'.",
    readings: [
      {
        lens: "como o fato contínuo",
        verdict: "retrofit",
        reason:
          "O fato sobre alcaloides existe desde 2009, começou sem fonte, e a citação foi trocada (Fu 2002 → Sun-Edelstein).",
      },
      {
        lens: "como a frase atual exata",
        verdict: "born-sourced",
        reason:
          "A redação atual e a citação Sun-Edelstein nasceram juntas no rewrite de 2014.",
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
        note: '"foram removidos" → "contém"',
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
        note: '"é tóxico" → "pode conter, se não purificado"',
      },
    },
  ],
  credibilityRead:
    "A redação e a evidência mudaram várias vezes. A fronteira 'o que conta como a mesma afirmação?' é sua — o produto mostra as duas leituras e a evolução que as separa.",
  meta: {
    generatedBy: "manual-trace",
    notes:
      "janelas bracketadas por leitura de conteúdo; revid exato do rewrite de 2014 não pinado",
  },
};
