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
    summary: "Sempre teve fonte, mas a evidência girou 3× — todas mídia popular.",
  },
  timeline: [
    {
      id: "e0",
      date: "2005",
      kind: "claim-absent",
      note: "a afirmação ainda não existe no artigo",
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
    "Nunca esteve sem fonte, mas a evidência foi trocada 3× em 8 anos, e as três fontes são mídia popular, nenhuma primária. Um meme de 2013 vestindo uma citação de jornal de 2019.",
  sourceQuality: {
    note: "as três fontes são mídia popular, nenhuma primária ou científica",
    flags: ["no-primary-source"],
  },
  meta: {
    generatedBy: "manual-trace",
    notes:
      "trocas bracketadas por leitura de conteúdo; revids exatos das trocas não pinados",
  },
};
