import { describe, expect, it } from "vitest";
import { wordDiff } from "@/lib/wordDiff";

const kept = (p: string, n: string) =>
  wordDiff(p, n)
    .filter((t) => t.op === "same")
    .map((t) => t.text);
const added = (p: string, n: string) =>
  wordDiff(p, n)
    .filter((t) => t.op === "add")
    .map((t) => t.text);
const removed = (p: string, n: string) =>
  wordDiff(p, n)
    .filter((t) => t.op === "del")
    .map((t) => t.text);

describe("wordDiff", () => {
  it("marks identical wordings as all-same", () => {
    const d = wordDiff("the happiest animal", "the happiest animal");
    expect(d.every((t) => t.op === "same")).toBe(true);
    expect(d.map((t) => t.text)).toEqual(["the", "happiest", "animal"]);
  });

  it("keeps the shared core and flags the added words", () => {
    const p = "the happiest animal";
    const n = "the world's happiest animal on earth";
    expect(kept(p, n)).toEqual(["the", "happiest", "animal"]);
    expect(added(p, n)).toEqual(["world's", "on", "earth"]);
    expect(removed(p, n)).toEqual([]);
  });

  it("flags removed words", () => {
    const p = "she received the prize and was hospitalised";
    const n = "she received the prize";
    expect(removed(p, n)).toEqual(["and", "was", "hospitalised"]);
    expect(added(p, n)).toEqual([]);
  });

  it("ignores casing and punctuation when matching", () => {
    const d = wordDiff("The Prize.", "the prize");
    expect(d.every((t) => t.op === "same")).toBe(true);
    // renders the NEW side's text for kept tokens
    expect(d.map((t) => t.text)).toEqual(["the", "prize"]);
  });

  it("preserves order across a mixed rewording", () => {
    const d = wordDiff("a fast brown fox", "a quick brown cat");
    expect(d.map((t) => `${t.op}:${t.text}`)).toEqual([
      "same:a",
      "del:fast",
      "add:quick",
      "same:brown",
      "del:fox",
      "add:cat",
    ]);
  });

  it("handles empty sides", () => {
    expect(wordDiff("", "new words").every((t) => t.op === "add")).toBe(true);
    expect(wordDiff("old words", "").every((t) => t.op === "del")).toBe(true);
    expect(wordDiff("", "")).toEqual([]);
  });
});
