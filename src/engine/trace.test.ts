import { describe, expect, it } from "vitest";
import { ClaimNotFoundError, traceClaim } from "@/engine/trace.ts";
import { fakeWiki, type FakeRevision } from "@/test/fakeWiki";

function history(revisions: FakeRevision[]) {
  return fakeWiki({ title: "Subject", revisions }).fetchJson;
}

const UNRELATED = "This paragraph is about something else entirely and unrelated.";

describe("traceClaim — verdicts", () => {
  it("classifies a claim born with its citation as born-sourced", async () => {
    const sourced =
      "The quokka smiles for the cameras of delighted tourists.<ref>{{cite news|newspaper=The Guardian|title=Q|date=2016}}</ref>";
    const fetchJson = history([
      { revid: 1, timestamp: "2015-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2016-06-01T00:00:00Z", content: sourced },
      { revid: 3, timestamp: "2020-01-01T00:00:00Z", content: sourced },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "smiles for the cameras of delighted tourists",
      fetchJson,
    });

    expect(prov.verdict.primary).toBe("born-sourced");
    expect(prov.timeline[0].kind).toBe("claim-absent");
    expect(prov.timeline.some((e) => e.kind === "claim-introduced")).toBe(true);
    expect(prov.meta.corpus?.total).toBe(3);
  });

  it("classifies a claim that gained its citation later as retrofit", async () => {
    const bare = "The quokka is widely called the happiest animal on the earth.";
    const cited =
      "The quokka is widely called the happiest animal on the earth.<ref>{{cite news|newspaper=The Times|title=Q|date=2015}}</ref>";
    const fetchJson = history([
      { revid: 1, timestamp: "2014-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2016-01-01T00:00:00Z", content: bare },
      { revid: 3, timestamp: "2020-01-01T00:00:00Z", content: cited },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "happiest animal on the earth",
      fetchJson,
    });

    expect(prov.verdict.primary).toBe("retrofit");
    expect(prov.annotations?.circularLoop).toBeUndefined();
  });

  it("flags citogenesis when the retrofitted source postdates the claim", async () => {
    const bare = "The coati is affectionately known as a Brazilian aardvark by locals.";
    const cited =
      "The coati is affectionately known as a Brazilian aardvark by locals.<ref>{{cite news|newspaper=The Independent|title=Coati|date=2019}}</ref>";
    const fetchJson = history([
      { revid: 1, timestamp: "2007-01-01T00:00:00Z", content: bare },
      { revid: 2, timestamp: "2020-01-01T00:00:00Z", content: cited },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "known as a Brazilian aardvark",
      fetchJson,
    });

    expect(prov.verdict.primary).toBe("retrofit");
    expect(prov.annotations?.circularLoop).toBeDefined();
    expect(prov.annotations!.circularLoop!.cycle).toHaveLength(3);
    expect(prov.verdict.summary).toMatch(/circular/i);
  });

  it("classifies a never-cited but never-removed claim as unsourced-stable", async () => {
    const bare = "The subject has an unusually complicated administrative boundary here.";
    const fetchJson = history([
      { revid: 1, timestamp: "2010-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2012-01-01T00:00:00Z", content: bare },
      { revid: 3, timestamp: "2020-01-01T00:00:00Z", content: bare },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "unusually complicated administrative boundary",
      fetchJson,
    });

    expect(prov.verdict.primary).toBe("unsourced-stable");
  });

  it("records a removal when the claim is gone from the latest revision", async () => {
    const withClaim = "The stadium once held the outright world attendance record for football.";
    const fetchJson = history([
      { revid: 1, timestamp: "2010-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2012-01-01T00:00:00Z", content: withClaim },
      { revid: 3, timestamp: "2020-01-01T00:00:00Z", content: UNRELATED },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "outright world attendance record for football",
      fetchJson,
    });

    expect(prov.timeline.some((e) => e.kind === "removed")).toBe(true);
    expect(prov.verdict.summary).toMatch(/removed/i);
  });

  it("throws ClaimNotFoundError when the phrase never appears", async () => {
    const fetchJson = history([
      { revid: 1, timestamp: "2010-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2020-01-01T00:00:00Z", content: UNRELATED },
    ]);
    await expect(
      traceClaim({ article: "Subject", phrase: "a phrase that is simply not present", fetchJson }),
    ).rejects.toBeInstanceOf(ClaimNotFoundError);
  });

  it("reports progress phases to the onProgress callback", async () => {
    const bare = "The subject has an unusually complicated administrative boundary here.";
    const fetchJson = history([
      { revid: 1, timestamp: "2010-01-01T00:00:00Z", content: bare },
      { revid: 2, timestamp: "2020-01-01T00:00:00Z", content: bare },
    ]);
    const phases: string[] = [];
    await traceClaim({
      article: "Subject",
      phrase: "unusually complicated administrative boundary",
      fetchJson,
      onProgress: (p) => phases.push(p.phase),
    });
    expect(phases[0]).toBe("listing");
    expect(phases).toContain("located");
    expect(phases).toContain("detecting");
  });
});
