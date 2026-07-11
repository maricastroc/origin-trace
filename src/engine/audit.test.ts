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

  it("flags a cited claim whose <ref> can't be parsed as refUnparsed, not unsourced", () => {
    const secs = segmentArticle(
      "The bandicoot is a nocturnal marsupial native to the Australian mainland.<ref>Field notes, unpublished.</ref>\n",
    );
    const claim = secs[0].claims[0];
    expect(claim.status).toBe("sourced");
    expect(claim.source).toBeNull();
    expect(claim.refUnparsed).toBe(true);
  });

  it("resolves a reuse pointer (<ref name=x/>) to its named definition", () => {
    const secs = segmentArticle(
      "The quoll is a carnivorous marsupial native to mainland Australia and Tasmania.<ref name=abc>{{citar web|url=https://example.org/quoll|titulo=Quoll}}</ref>\n\n" +
        "== Diet ==\nThe quoll hunts insects and small vertebrates across a wide home range each night.<ref name=abc/>\n",
    );
    const reuse = secs[1].claims[0];
    expect(reuse.status).toBe("sourced");
    expect(reuse.refUnparsed).toBeUndefined();
    expect(reuse.source?.label).toBe("example.org");
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
    expect(
      sentences("Dr. Smith measured 3.5 km before dusk. The team left camp."),
    ).toEqual([
      "Dr. Smith measured 3.5 km before dusk.",
      "The team left camp.",
    ]);
  });

  it("splits standard sentence boundaries", () => {
    expect(
      sentences("First claim stands alone. Second claim follows it."),
    ).toEqual(["First claim stands alone.", "Second claim follows it."]);
  });

  it("skips list items and table markup, keeping only prose", () => {
    const out = sentences(
      "Real prose sentence here.\n* a bullet item\n{| table |}",
    );
    expect(out).toEqual(["Real prose sentence here."]);
  });

  it("recovers prose after an unclosed table instead of swallowing it", () => {
    const out = sentences(
      'First prose sentence stands here fine.\n{| class="wikitable"\n| a || b\nSecond prose sentence after the broken table must survive.\n',
    );
    expect(out.some((s) => s.includes("First prose sentence stands"))).toBe(
      true,
    );
    expect(
      out.some((s) => s.includes("Second prose sentence after the broken")),
    ).toBe(true);
  });

  it("recovers prose after an unclosed media link instead of skipping it", () => {
    const out = sentences(
      "Intro prose sentence sits before the image here.\n[[File:example.jpg|thumb|a caption\nTrailing prose sentence after the unclosed file link should survive.\n",
    );
    expect(out.some((s) => s.includes("Intro prose sentence sits"))).toBe(true);
    expect(
      out.some((s) => s.includes("Trailing prose sentence after the unclosed")),
    ).toBe(true);
  });
});

describe("auditArticle", () => {
  it("audits the current revision and tallies coverage", async () => {
    const { fetchJson } = fakeWiki({
      title: "Quokka",
      revisions: [
        { revid: 555, timestamp: "2020-01-01T00:00:00Z", content: ARTICLE },
      ],
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
      revisions: [
        { revid: 1, timestamp: "2020-01-01T00:00:00Z", content: ARTICLE },
      ],
    });
    await expect(
      auditArticle({ article: "Nonexistent Title", fetchJson }),
    ).rejects.toBeInstanceOf(ArticleNotFoundError);
  });
});
