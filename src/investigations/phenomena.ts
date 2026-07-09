import type { PhenomenonId } from "./types.ts";

// The capability matrix. Ordering doubles as the reading order of the section —
// from the most alarming failure mode to the most benign.

export interface Phenomenon {
  id: PhenomenonId;
  label: string;
  blurb: string;
}

export const PHENOMENA: Phenomenon[] = [
  {
    id: "citogenesis",
    label: "Citogenesis",
    blurb:
      "The cited source postdates the claim — Wikipedia asserted it first, the reference caught up later. Circular by construction.",
  },
  {
    id: "unsourced-stable",
    label: "Unsourced, stable",
    blurb:
      "Never carried a citation in its entire history, yet no one ever removed it. Presented as fact, never backed.",
  },
  {
    id: "retrofit",
    label: "Retrofit",
    blurb:
      "Born as an unsourced assertion; a citation was bolted on later. The backing is retroactive.",
  },
  {
    id: "note-not-source",
    label: "Note, not source",
    blurb:
      "Wears a footnote marker that looks like a reference but cites nothing — an explanatory note, not evidence.",
  },
  {
    id: "ambiguous",
    label: "Ambiguous",
    blurb:
      "The verdict depends on where you draw the claim boundary — the same sentence reads two ways.",
  },
  {
    id: "born-sourced",
    label: "Born sourced",
    blurb:
      "Claim and citation entered together — its evidence is as old as the assertion. The clean case.",
  },
  {
    id: "coverage",
    label: "Coverage map",
    blurb:
      "The other engine mode: one read of an article maps every sentence to its evidence. Uncited is descriptive, not a verdict — citations cluster at paragraph ends.",
  },
];

export const phenomenonById = (id: PhenomenonId): Phenomenon =>
  PHENOMENA.find((p) => p.id === id) ?? PHENOMENA[PHENOMENA.length - 1];
