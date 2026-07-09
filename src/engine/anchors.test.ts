import { describe, expect, it } from "vitest";
import { extractAnchors, hasAnchors, sharedAnchors } from "@/engine/anchors.ts";

const values = (s: string) =>
  extractAnchors(s)
    .map((a) => `${a.kind}:${a.value}`)
    .sort();

describe("extractAnchors", () => {
  it("pulls multi-digit numbers and mid-sentence proper nouns, folds case", () => {
    // "Neymar" leads the sentence, so it's demoted as ambiguous; "Barcelona" and 100 stay.
    expect(values("Neymar scored 100 goals for Barcelona.")).toEqual([
      "name:barcelona",
      "number:100",
    ]);
  });

  it("demotes an isolated sentence-initial capital but keeps mid-sentence names", () => {
    // "Near" is a capitalized common word only because it starts the sentence.
    expect(values("Near perihelion Pluto passes inside Neptune.")).toEqual([
      "name:neptune",
      "name:pluto",
    ]);
  });

  it("keeps a year but ignores the sentence-initial capital and function words", () => {
    // "During" is a stopword; the only anchor is the year.
    expect(values("During 2004 the event happened.")).toEqual(["number:2004"]);
  });

  it("treats a genuine leading subject as an anchor", () => {
    expect(values("Gustave Eiffel designed it.")).toEqual([
      "name:eiffel",
      "name:gustave",
    ]);
  });

  it("drops single-digit numbers as too weak to guard on", () => {
    expect(extractAnchors("He had 3 sons.")).toEqual([]);
  });

  it("returns nothing for an anchor-poor claim", () => {
    expect(extractAnchors("The animal is nocturnal.")).toEqual([]);
    expect(hasAnchors("The animal is nocturnal.")).toBe(false);
  });

  it("strips thousands separators", () => {
    expect(values("The population reached 1,998 residents.")).toEqual([
      "number:1998",
    ]);
  });
});

describe("sharedAnchors", () => {
  it("bridges a reword that preserves the invariant fact", () => {
    const shared = sharedAnchors(
      "The company began operations in 1998.",
      "The company was founded in 1998.",
    );
    expect(shared.map((a) => a.value)).toEqual(["1998"]);
  });

  it("finds nothing across a reword that changed the facts", () => {
    expect(
      sharedAnchors(
        "The squad triumphed in 2004.",
        "The team won the 1990 title.",
      ),
    ).toEqual([]);
  });
});
