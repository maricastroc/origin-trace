import { describe, expect, it } from "vitest";
import { reconstructGenealogy } from "@/engine/genealogy.ts";
import type { FetchJson } from "@/engine/wikipedia.ts";

interface FakeRev {
  revid: number;
  parentid: number;
  timestamp: string;
  content: string;
  comment?: string;
}

function fakeWiki(revs: FakeRev[]): FetchJson {
  return async (url) => {
    const params = new URL(url).searchParams;
    if (params.has("revids")) {
      const ids = params.get("revids")!.split("|").map(Number);
      return {
        query: {
          pages: [
            {
              revisions: revs
                .filter((r) => ids.includes(r.revid))
                .map((r) => ({
                  revid: r.revid,
                  slots: { main: { content: r.content } },
                })),
            },
          ],
        },
      };
    }
    return {
      query: {
        pages: [
          {
            revisions: revs.map((r) => ({
              revid: r.revid,
              parentid: r.parentid,
              timestamp: r.timestamp,
              comment: r.comment ?? "",
            })),
          },
        ],
      },
    };
  };
}

function run(phrase: string, revs: FakeRev[], article = "Test") {
  return reconstructGenealogy({ article, phrase, fetchJson: fakeWiki(revs) });
}

const OVERVIEW = "This article describes a subject.";

describe("reconstructGenealogy", () => {
  it("follows a reworded sentence back to its anchor-shared ancestor", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: OVERVIEW,
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2009-05-01T00:00:00Z",
        content: `${OVERVIEW} The company was founded in 1998.`,
      },
      {
        revid: 102,
        parentid: 101,
        timestamp: "2011-05-01T00:00:00Z",
        content: `${OVERVIEW} The company was founded in 1998.`,
      },
      {
        revid: 103,
        parentid: 102,
        timestamp: "2014-05-01T00:00:00Z",
        content: `${OVERVIEW} The company began operations in 1998.`,
      },
      {
        revid: 104,
        parentid: 103,
        timestamp: "2016-05-01T00:00:00Z",
        content: `${OVERVIEW} The company began operations in 1998.`,
      },
    ];

    const g = await run("began operations in 1998", revs);

    expect(g.terminus).toBe("origin:fresh-insertion");
    expect(g.lexicalOrigin.revId).toBe(103);
    expect(g.origin.revId).toBe(101);
    expect(g.origin.date).toBe("2009-05");
    expect(g.movedEarlier).toBe(true);
    expect(g.chain).toHaveLength(2);
    expect(g.chain[0].anchorsShared).toContain("1998");
    expect(g.chain[1].anchorsShared).toEqual([]);
  });

  it("flips the verdict when the reworded wording was born unsourced", async () => {
    const cited = `${OVERVIEW} The company began operations in 1998.<ref>{{cite news|newspaper=The Times|date=2015}}</ref>`;
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: OVERVIEW,
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2009-05-01T00:00:00Z",
        content: `${OVERVIEW} The company was founded in 1998.`,
      },
      {
        revid: 102,
        parentid: 101,
        timestamp: "2014-05-01T00:00:00Z",
        content: cited,
      },
    ];

    const g = await run("began operations in 1998", revs);

    expect(g.lexicalOrigin.sourced).toBe(true);
    expect(g.origin.sourced).toBe(false);
    expect(g.verdictShift).toEqual({
      from: "born-sourced",
      to: "unsourced-at-origin",
    });
  });

  it("abstains when a replacement shares a strong anchor but little content (low overlap)", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Overview line.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2010-05-01T00:00:00Z",
        content:
          "Overview line. In 1838 William Whewell recruited Darwin as society secretary.",
      },
      {
        revid: 102,
        parentid: 101,
        timestamp: "2014-05-01T00:00:00Z",
        content:
          "Overview line. In 1838 he went geologising across the Scottish highlands.",
      },
    ];

    const g = await run("geologising across the Scottish highlands", revs);

    expect(g.terminus).toBe("broke:low-overlap");
    expect(g.movedEarlier).toBe(false);
    expect(g.chain).toHaveLength(1);
    expect(g.stopOverlap).not.toBeNull();
    expect(g.stopOverlap!).toBeLessThan(0.55);
  });

  it("abstains on a shared subject clause with a different predicate (no false shift)", async () => {
    const subject =
      "In 1930 John Smith, a scientist at the National Institute in London,";
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Overview line.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2009-05-01T00:00:00Z",
        content: `Overview line. ${subject} attempted to treat a rare tropical disease but the effort failed completely.`,
      },
      {
        revid: 102,
        parentid: 101,
        timestamp: "2014-05-01T00:00:00Z",
        content: `Overview line. ${subject} successfully cured a widespread bacterial infection with an innovative surgical technique.<ref>{{cite journal|journal=Nature|date=2015}}</ref>`,
      },
    ];

    const g = await run(
      "successfully cured a widespread bacterial infection",
      revs,
    );

    expect(g.terminus).toBe("broke:low-overlap");
    expect(g.verdictShift).toBeNull();
    expect(g.chain).toHaveLength(1);
    expect(g.stopOverlap!).toBeLessThan(0.55);
  });

  it("keeps a multi-hop retrofit whose hops are genuine copy-edits", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2006-01-01T00:00:00Z",
        content: "Overview line.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2006-06-01T00:00:00Z",
        content:
          "Overview line. In 1911 Marie received the prize and was hospitalized with a serious illness.",
      },
      {
        revid: 102,
        parentid: 101,
        timestamp: "2009-06-01T00:00:00Z",
        content:
          "Overview line. In 1911 Marie received the prize and was hospitalised with a serious illness.",
      },
      {
        revid: 103,
        parentid: 102,
        timestamp: "2012-06-01T00:00:00Z",
        content:
          "Overview line. In 1911 she received the prize and was hospitalised with a serious illness.<ref>{{cite book|title=Bio|date=2010}}</ref>",
      },
    ];

    const g = await run("she received the prize and was hospitalised", revs);

    expect(g.chain).toHaveLength(3);
    expect(g.verdictShift).toEqual({
      from: "born-sourced",
      to: "unsourced-at-origin",
    });
    expect(g.lexicalOrigin.sourced).toBe(true);
    expect(g.origin.sourced).toBe(false);
  });

  it("stops at a positional replacement that shares no anchor", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Overview line.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2010-05-01T00:00:00Z",
        content: "Overview line. The team won the 1990 title.",
      },
      {
        revid: 102,
        parentid: 101,
        timestamp: "2014-05-01T00:00:00Z",
        content: "Overview line. The squad triumphed in 2004.",
      },
    ];

    const g = await run("squad triumphed in 2004", revs);

    expect(g.terminus).toBe("broke:no-anchor-reword");
    expect(g.movedEarlier).toBe(false);
    expect(g.chain).toHaveLength(1);
  });

  it("reports an anchor-poor claim as unrecoverable", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Overview line.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2011-05-01T00:00:00Z",
        content: "Overview line. The animal is nocturnal.",
      },
    ];

    const g = await run("animal is nocturnal", revs);

    expect(g.terminus).toBe("broke:no-anchors");
  });

  it("does not treat a lead sentence as 'earlier' just because it repeats its own title", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Background text. The Great Wall of China is famous.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2010-05-01T00:00:00Z",
        content:
          "Background text. The Great Wall of China is famous. The Great Wall of China is a series of fortifications.",
      },
    ];

    const g = await run(
      "series of fortifications",
      revs,
      "Great Wall of China",
    );

    expect(g.terminus).toBe("origin:fresh-insertion");
  });

  it("detects a fact prosified out of the infobox", async () => {
    const infobox = "{{Infobox company | founded = 1998}}";
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: `Overview line.\n\n${infobox}`,
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2012-05-01T00:00:00Z",
        content: `Overview line. The company was founded in 1998.\n\n${infobox}`,
      },
    ];

    const g = await run("company was founded in 1998", revs);

    expect(g.terminus).toBe("broke:structured-genesis");
  });

  it("flags a merge/import edit as crossing the article boundary", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Overview line.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2012-05-01T00:00:00Z",
        content: "Overview line. The company was founded in 1998.",
        comment: "merged from [[Other Article]]",
      },
    ];

    const g = await run("company was founded in 1998", revs);

    expect(g.terminus).toBe("broke:cross-article-merge");
  });

  it("classifies a large batch edit (no merge marker) as a bulk-insertion origin", async () => {
    const filler = Array.from(
      { length: 45 },
      (_, i) => `Filler sentence ${i} adds prose.`,
    ).join(" ");
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: "Start.",
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2012-05-01T00:00:00Z",
        content: `Start. The company was founded in 1998. ${filler}`,
        comment: "expand article",
      },
    ];

    const g = await run("company was founded in 1998", revs);

    expect(g.terminus).toBe("origin:bulk-insertion");
  });

  it("recognizes a claim that has been present since the first revision", async () => {
    const revs: FakeRev[] = [
      {
        revid: 100,
        parentid: 0,
        timestamp: "2008-02-01T00:00:00Z",
        content: `${OVERVIEW} The company was founded in 1998.`,
      },
      {
        revid: 101,
        parentid: 100,
        timestamp: "2010-05-01T00:00:00Z",
        content: `${OVERVIEW} The company was founded in 1998.`,
      },
    ];

    const g = await run("company was founded in 1998", revs);

    expect(g.terminus).toBe("origin:first-revision");
    expect(g.origin.revId).toBe(100);
    expect(g.movedEarlier).toBe(false);
  });
});
