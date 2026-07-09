import { describe, expect, it } from "vitest";
import type { ArticleAudit } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import type { AuditSection } from "@/types/AuditSection";
import type { SentenceStatus } from "@/types/SentenceStatus";
import { buildAuditModel } from "@/lib/auditModel";

let seq = 0;
function claim(
  status: SentenceStatus,
  text = "a plain descriptive sentence",
): AuditClaim {
  return { id: `c${seq++}`, text, status };
}
function section(
  heading: string,
  claims: AuditClaim[],
  over: Partial<AuditSection> = {},
): AuditSection {
  return { heading, level: 2, isLead: false, claims, ...over };
}
function audit(sections: AuditSection[]): ArticleAudit {
  return {
    article: { title: "T", url: "u", lang: "en", revId: 1 },
    sections,
    summary: {
      body: { total: 0, sourced: 0, noteOnly: 0, unsourced: 0 },
      lead: { total: 0, sourced: 0, noteOnly: 0, unsourced: 0 },
      coverage: 1,
    },
    meta: { generatedBy: "wikiblame-audit", fetchedAt: "", notes: "" },
  };
}

describe("buildAuditModel", () => {
  it("totals every status across lead and body, but counts sections excluding the lead", () => {
    const model = buildAuditModel(
      audit([
        section("Lead", [claim("sourced"), claim("unsourced")], {
          isLead: true,
        }),
        section("Body", [
          claim("sourced"),
          claim("note-only"),
          claim("unsourced"),
        ]),
      ]),
    );
    expect(model.totals).toEqual({
      sourced: 2,
      noteOnly: 1,
      unsourced: 2,
      sentences: 5,
    });
    expect(model.sectionCount).toBe(1);
  });

  it("collects high-impact claims that are not sourced, tagged with their section label", () => {
    const model = buildAuditModel(
      audit([
        section("Lead", [claim("unsourced", "the greatest of all time")], {
          isLead: true,
        }),
        section("Career", [
          claim("sourced", "the greatest of all time"),
          claim("note-only", "a record-breaking run"),
        ]),
      ]),
    );
    expect(model.highImpact).toHaveLength(2);
    expect(model.highImpact.map((h) => h.sectionLabel)).toEqual([
      "Lead",
      "Career",
    ]);
    expect(model.highImpact.every((h) => h.claim.status !== "sourced")).toBe(
      true,
    );
  });

  it("ranks only body sections with at least 3 claims by coverage", () => {
    const weak = section("Weak", [
      claim("unsourced"),
      claim("unsourced"),
      claim("sourced"),
    ]);
    const strong = section("Strong", [
      claim("sourced"),
      claim("sourced"),
      claim("unsourced"),
    ]);
    const tiny = section("Tiny", [claim("unsourced")]);

    const model = buildAuditModel(audit([weak, strong, tiny]));
    expect(model.worstSections.map((s) => s.label)).toEqual(["Weak", "Strong"]);
    expect(model.bestSection?.label).toBe("Strong");
    expect(model.worstSections.some((s) => s.label === "Tiny")).toBe(false);
  });

  it("reports the longest unsourced run only when it reaches 3", () => {
    const twoRun = buildAuditModel(
      audit([
        section("A", [
          claim("unsourced"),
          claim("unsourced"),
          claim("sourced"),
        ]),
      ]),
    );
    expect(twoRun.longestRun).toBeNull();

    const threeRun = buildAuditModel(
      audit([
        section("Streaky", [
          claim("sourced"),
          claim("unsourced"),
          claim("unsourced"),
          claim("unsourced"),
          claim("sourced"),
        ]),
      ]),
    );
    expect(threeRun.longestRun).toEqual({ count: 3, label: "Streaky" });
  });

  it("has no best section or runs when there is nothing rankable", () => {
    const model = buildAuditModel(
      audit([section("Lead", [claim("sourced")], { isLead: true })]),
    );
    expect(model.bestSection).toBeNull();
    expect(model.worstSections).toEqual([]);
    expect(model.longestRun).toBeNull();
  });
});
