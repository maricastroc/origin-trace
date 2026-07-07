import { describe, expect, it } from "vitest";
import {
  ArticleNotFoundError,
  auditArticle,
  segmentArticle,
  sentences,
} from "@/engine/audit.ts";
import { fakeWiki } from "@/test/fakeWiki";

const ARTICLE = `The '''Quokka''' is a small marsupial found in Australia and nearby islands.<ref>{{cite news|newspaper=The Guardian|title=Q|date=2019}}</ref> It is often called the happiest animal on earth by tourists and journalists worldwide.

== Behaviour ==
Quokkas are mostly nocturnal creatures that rest during the daytime hours in shade. They can climb small trees and shrubs to reach the freshest leaves.<ref>{{cite journal|journal=Nature|title=X}}</ref>

== References ==
{{reflist}}
`;

describe("segmentArticle", () => {
  const sections = segmentArticle(ARTICLE);

  it("keeps the lead and body prose but drops apparatus sections", () => {
    expect(sections).toHaveLength(2);
    expect(sections[0].isLead).toBe(true);
    expect(sections[1].heading).toBe("Behaviour");
    expect(sections.some((s) => /references/i.test(s.heading))).toBe(false);
  });

  it("classifies each sentence by whether an inline citation sits on it", () => {
    expect(sections[0].claims.map((c) => c.status)).toEqual([
      "sourced",
      "unsourced",
    ]);
    expect(sections[0].claims[0].source?.label).toBe("The Guardian");
    expect(sections[1].claims.map((c) => c.status)).toEqual([
      "unsourced",
      "sourced",
    ]);
  });

  it("strips ref/markup from the displayed claim text", () => {
    for (const section of sections) {
      for (const claim of section.claims) {
        expect(claim.text).not.toContain("<ref");
        expect(claim.text).not.toContain("'''");
      }
    }
  });

  it("drops trivially short or non-prose fragments", () => {
    const secs = segmentArticle("== Notes ==\nOk.\nSee also below.\n");
    expect(secs).toHaveLength(0);
  });
});

describe("sentences", () => {
  it("does not split on abbreviations or decimals", () => {
    expect(sentences("Dr. Smith measured 3.5 km before dusk. The team left camp.")).toEqual([
      "Dr. Smith measured 3.5 km before dusk.",
      "The team left camp.",
    ]);
  });

  it("splits standard sentence boundaries", () => {
    expect(sentences("First claim stands alone. Second claim follows it.")).toEqual([
      "First claim stands alone.",
      "Second claim follows it.",
    ]);
  });

  it("skips list items and table markup, keeping only prose", () => {
    const out = sentences("Real prose sentence here.\n* a bullet item\n{| table |}");
    expect(out).toEqual(["Real prose sentence here."]);
  });
});

describe("auditArticle", () => {
  it("audits the current revision and tallies coverage", async () => {
    const { fetchJson } = fakeWiki({
      title: "Quokka",
      revisions: [{ revid: 555, timestamp: "2020-01-01T00:00:00Z", content: ARTICLE }],
    });

    const audit = await auditArticle({ article: "Quokka", fetchJson });

    expect(audit.article.revId).toBe(555);
    expect(audit.article.url).toContain("/wiki/Quokka");
    expect(audit.sections).toHaveLength(2);
    expect(audit.summary.body.sourced).toBe(1);
    expect(audit.summary.lead.total).toBe(2);
    expect(audit.summary.coverage).toBeCloseTo(0.5);
  });

  it("throws ArticleNotFoundError for a missing article", async () => {
    const { fetchJson } = fakeWiki({
      title: "Quokka",
      revisions: [{ revid: 1, timestamp: "2020-01-01T00:00:00Z", content: ARTICLE }],
    });
    await expect(
      auditArticle({ article: "Nonexistent Title", fetchJson }),
    ).rejects.toBeInstanceOf(ArticleNotFoundError);
  });
});
