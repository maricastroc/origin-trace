import { describe, expect, it } from "vitest";
import { changeTagLabel } from "@/lib/changeTagLabel";
import { confidenceLabel } from "@/lib/confidenceLabel";
import { errMsg } from "@/lib/errMsg";
import { eventKindLabel } from "@/lib/eventKindLabel";
import { sourceTypeLabel } from "@/lib/sourceTypeLabel";
import { verdictStyle } from "@/lib/verdictStyle";

describe("label maps", () => {
  it("map every enum member to a non-empty label", () => {
    for (const map of [
      confidenceLabel,
      changeTagLabel,
      eventKindLabel,
      sourceTypeLabel,
    ]) {
      for (const value of Object.values(map)) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("rename the machine keys to human phrasing", () => {
    expect(changeTagLabel["evidence-changed"]).toBe("source swapped");
    expect(sourceTypeLabel["peer-reviewed"]).toBe("peer-reviewed");
    expect(sourceTypeLabel["popular-media"]).toBe("popular media");
    expect(eventKindLabel["claim-introduced"]).toBe("· claim introduced");
  });
});

describe("verdictStyle", () => {
  it("gives each verdict a severity-consistent palette", () => {
    for (const style of Object.values(verdictStyle)) {
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.meaning.length).toBeGreaterThan(0);
      expect(style.tint).toMatch(/^bg-/);
      expect(style.dot).toMatch(/^bg-/);
      expect(style.ink).toMatch(/^text-/);
    }
  });

  it("orders severity by rank, best (born-sourced) lowest", () => {
    expect(verdictStyle["born-sourced"].rank).toBeLessThan(
      verdictStyle["unsourced-stable"].rank,
    );
    expect(verdictStyle["born-sourced"].severity).toBe("good");
    expect(verdictStyle["unsourced-stable"].severity).toBe("alert");
  });
});

describe("errMsg", () => {
  it("extracts the message from an Error", () => {
    expect(errMsg(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error throwables", () => {
    expect(errMsg("plain string")).toBe("plain string");
    expect(errMsg(404)).toBe("404");
    expect(errMsg(null)).toBe("null");
  });
});
