import { describe, expect, it } from "vitest";
import type { AuditClaim } from "@/types/AuditClaim";
import type { AuditSection } from "@/types/AuditSection";
import type { SentenceStatus } from "@/types/SentenceStatus";
import {
  countMatching,
  matchesFilter,
  matchesQuery,
  sectionMetrics,
  sectionSlug,
} from "@/lib/auditMetrics";

let seq = 0;
function claim(status: SentenceStatus, text = "some plain claim"): AuditClaim {
  return { id: `c${seq++}`, text, status };
}
function section(claims: AuditClaim[], over: Partial<AuditSection> = {}): AuditSection {
  return { heading: "Body", level: 2, isLead: false, claims, ...over };
}

describe("sectionMetrics", () => {
  it("counts each status bucket and computes coverage", () => {
    const m = sectionMetrics(
      section([
        claim("sourced"),
        claim("sourced"),
        claim("note-only"),
        claim("unsourced"),
      ]),
    );
    expect(m).toMatchObject({ total: 4, sourced: 2, noteOnly: 1, unsourced: 1 });
    expect(m.coverage).toBeCloseTo(0.5);
  });

  it("treats an empty section as fully covered (coverage 1)", () => {
    const m = sectionMetrics(section([]));
    expect(m).toMatchObject({ total: 0, sourced: 0, coverage: 1 });
  });
});

describe("matchesQuery", () => {
  it("matches everything when the query is blank or whitespace", () => {
    expect(matchesQuery("anything", "")).toBe(true);
    expect(matchesQuery("anything", "   ")).toBe(true);
  });

  it("is a case-insensitive substring match", () => {
    expect(matchesQuery("The Great Barrier Reef", "barrier")).toBe(true);
    expect(matchesQuery("The Great Barrier Reef", "BARRIER")).toBe(true);
    expect(matchesQuery("The Great Barrier Reef", "desert")).toBe(false);
  });
});

describe("matchesFilter", () => {
  const sourced = claim("sourced", "the greatest of all time");
  const note = claim("note-only", "the greatest of all time");
  const unsourced = claim("unsourced", "the greatest of all time");
  const plainUnsourced = claim("unsourced", "a plain factual sentence");

  it("all matches every status", () => {
    expect(matchesFilter(sourced, "all")).toBe(true);
    expect(matchesFilter(unsourced, "all")).toBe(true);
  });

  it("attention matches only unsourced", () => {
    expect(matchesFilter(unsourced, "attention")).toBe(true);
    expect(matchesFilter(note, "attention")).toBe(false);
    expect(matchesFilter(sourced, "attention")).toBe(false);
  });

  it("note matches only note-only, sourced matches only sourced", () => {
    expect(matchesFilter(note, "note")).toBe(true);
    expect(matchesFilter(sourced, "sourced")).toBe(true);
    expect(matchesFilter(note, "sourced")).toBe(false);
  });

  it("high matches unsourced/note-only high-impact claims but never sourced ones", () => {
    expect(matchesFilter(unsourced, "high")).toBe(true);
    expect(matchesFilter(note, "high")).toBe(true);
    expect(matchesFilter(plainUnsourced, "high")).toBe(false);
    expect(matchesFilter(sourced, "high")).toBe(false);
  });
});

describe("countMatching", () => {
  it("counts claims passing a filter", () => {
    const claims = [
      claim("sourced"),
      claim("unsourced"),
      claim("unsourced"),
      claim("note-only"),
    ];
    expect(countMatching(claims, "attention")).toBe(2);
    expect(countMatching(claims, "all")).toBe(4);
    expect(countMatching(claims, "sourced")).toBe(1);
  });
});

describe("sectionSlug", () => {
  it("uses a fixed slug for the lead", () => {
    expect(sectionSlug("Whatever", 0, true)).toBe("sec-0-lead");
  });

  it("kebab-cases the heading and prefixes the index", () => {
    expect(sectionSlug("Early Life & Career", 3, false)).toBe(
      "sec-3-early-life-career",
    );
  });

  it("falls back to 'section' when the heading has no slug characters", () => {
    expect(sectionSlug("!!!", 2, false)).toBe("sec-2-section");
  });
});
