import { describe, expect, it } from "vitest";
import { verdictConfidence, type ConfidenceSignals } from "./confidence.ts";

const base: ConfidenceSignals = {
  corrected: false,
  abstained: false,
  bornAtLatest: false,
  removedSince: false,
  origin: { reach: "resolved", bulkInsertion: false, nonMonotonic: false },
};

describe("verdictConfidence", () => {
  it("is high when genealogy reaches a clean prose origin and lenses agree", () => {
    expect(verdictConfidence(base).level).toBe("high");
  });

  it("is low whenever the two lenses disagree (ambiguous), regardless of the rest", () => {
    expect(verdictConfidence({ ...base, corrected: true }).level).toBe("low");
  });

  it("returns no reasons on a clean high, and a reason per downgrade otherwise", () => {
    expect(verdictConfidence(base).reasons).toEqual([]);
    const two = verdictConfidence({
      ...base,
      abstained: true,
      origin: { reach: "semantic", bulkInsertion: false, nonMonotonic: true },
    });
    expect(two.level).toBe("low");
    expect(two.reasons.length).toBe(3);
  });

  it("docks one level for a bulk-insertion origin", () => {
    expect(
      verdictConfidence({
        ...base,
        origin: { reach: "resolved", bulkInsertion: true, nonMonotonic: false },
      }).level,
    ).toBe("medium");
  });

  it("is medium on a single recoverable/semantic break, low when it also abstained", () => {
    expect(
      verdictConfidence({
        ...base,
        origin: {
          reach: "semantic",
          bulkInsertion: false,
          nonMonotonic: false,
        },
      }).level,
    ).toBe("medium");

    expect(
      verdictConfidence({
        ...base,
        abstained: true,
        origin: {
          reach: "semantic",
          bulkInsertion: false,
          nonMonotonic: false,
        },
      }).level,
    ).toBe("low");
  });

  it("is low when the claim carries no anchor to trace on (unrecoverable)", () => {
    expect(
      verdictConfidence({
        ...base,
        origin: {
          reach: "unrecoverable",
          bulkInsertion: false,
          nonMonotonic: false,
        },
      }).level,
    ).toBe("low");
  });

  it("caps a pure lexical fallback at medium, and low when the intro is the oldest fetched revision", () => {
    expect(verdictConfidence({ ...base, origin: null }).level).toBe("medium");
    expect(
      verdictConfidence({ ...base, origin: null, bornAtLatest: true }).level,
    ).toBe("low");
  });

  it("treats a non-monotonic chain as one downgrade", () => {
    expect(
      verdictConfidence({
        ...base,
        origin: { reach: "resolved", bulkInsertion: false, nonMonotonic: true },
      }).level,
    ).toBe("medium");
  });
});
