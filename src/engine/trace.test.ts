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

  it("marks a born-sourced claim whose <ref> can't be parsed as refUnparsed, not no-source", async () => {
    // A real <ref> is attached (so the claim IS sourced → born-sourced), but it
    // carries no cite template and no URL, so parseCitation returns null. The node
    // must read as "cited · source unreadable", never the red "no source" that
    // would contradict the born-sourced verdict.
    const unparsable =
      "The numbat forages for termites in the eucalypt woodlands of the south-west.<ref>Field notes, unpublished.</ref>";
    const fetchJson = history([
      { revid: 1, timestamp: "2015-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2016-06-01T00:00:00Z", content: unparsable },
      { revid: 3, timestamp: "2020-01-01T00:00:00Z", content: unparsable },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "forages for termites in the eucalypt woodlands",
      fetchJson,
    });

    expect(prov.verdict.primary).toBe("born-sourced");
    const introduced = prov.timeline.find((e) => e.kind === "claim-introduced");
    expect(introduced?.source).toBeNull();
    expect(introduced?.refUnparsed).toBe(true);
    // No node in a born-sourced trace may render as an outright no-source (source
    // null without the refUnparsed flag).
    const looksUncited = prov.timeline.some(
      (e) => e.source === null && !e.refUnparsed && e.kind !== "claim-absent",
    );
    expect(looksUncited).toBe(false);
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

  it("classifies a claim born cited then stripped of its citation as source-lost", async () => {
    // Born with a real citation (rev 2), the <ref> is later removed while the
    // sentence stays intact (rev 3) — so it is NOT a removal. `born-sourced` would
    // stamp a "sourced" health word over a claim the timeline shows as uncited now.
    const cited =
      "The bridge was the longest single-span structure in the country at the time.<ref>{{cite news|newspaper=The Herald|title=Span|date=2011}}</ref>";
    const stripped =
      "The bridge was the longest single-span structure in the country at the time.";
    const fetchJson = history([
      { revid: 1, timestamp: "2010-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2011-06-01T00:00:00Z", content: cited },
      { revid: 3, timestamp: "2020-01-01T00:00:00Z", content: stripped },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "longest single-span structure in the country",
      fetchJson,
    });

    expect(prov.verdict.primary).toBe("source-lost");
    // Born with a source...
    const intro = prov.timeline.find((e) => e.kind === "claim-introduced");
    expect(intro?.source).not.toBeNull();
    // ...uncited now (null source, no unreadable-ref caveat) — no contradiction.
    const present = [...prov.timeline].reverse().find((e) => e.kind !== "claim-absent");
    expect(present?.source).toBeNull();
    expect(present?.refUnparsed).toBeUndefined();
    expect(prov.verdict.summary).toMatch(/removed|unsourced/i);
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
    // The badge must not contradict the removal: a removed claim resolves to the
    // `removed` verdict, never `unsourced-stable` (whose gloss reads "never removed").
    expect(prov.verdict.primary).toBe("removed");
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

  it("reconstructs the reformulation chain and shows dual readings on a correction", async () => {
    // Current wording (sourced) descends via copy-edits from an unsourced 2006 origin.
    const cited =
      "In 1911 she received the prize and was hospitalised with a serious illness.<ref>{{cite book|title=Bio|date=2010}}</ref>";
    const fetchJson = history([
      { revid: 1, timestamp: "2006-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2006-06-01T00:00:00Z", content: "In 1911 Marie received the prize and was hospitalized with a serious illness." },
      { revid: 3, timestamp: "2009-06-01T00:00:00Z", content: "In 1911 Marie received the prize and was hospitalised with a serious illness." },
      { revid: 4, timestamp: "2013-06-01T00:00:00Z", content: cited },
      { revid: 5, timestamp: "2020-01-01T00:00:00Z", content: cited },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "she received the prize and was hospitalised",
      fetchJson,
    });

    // Lexical trace would say born-sourced (cited at its 2013 first appearance);
    // genealogy corrects to a retrofit born unsourced in 2006 — show both.
    expect(prov.verdict.primary).toBe("ambiguous");
    expect(prov.verdict.readings).toHaveLength(2);
    expect(prov.verdict.readings![0].verdict).toBe("born-sourced");
    expect(prov.verdict.readings![1].verdict).toBe("retrofit");

    const intro = prov.timeline.find((e) => e.kind === "claim-introduced");
    expect(intro?.date).toBe("2006-06");
    expect(intro?.source ?? null).toBeNull();
    expect(prov.timeline.some((e) => e.kind === "source-added")).toBe(true);
    expect(prov.timeline[prov.timeline.length - 1].kind).toBe("current");
    // origin (2006) predates the cited 2010 source → citogenesis surfaces at the true origin.
    expect(prov.annotations?.circularLoop).toBeDefined();
  });

  it("abstains from asserting an origin it can't confirm (low-overlap reword)", async () => {
    const fetchJson = history([
      { revid: 1, timestamp: "2008-01-01T00:00:00Z", content: UNRELATED },
      { revid: 2, timestamp: "2010-01-01T00:00:00Z", content: "In 1838 William Whewell recruited Darwin as society secretary." },
      { revid: 3, timestamp: "2014-01-01T00:00:00Z", content: "In 1838 he went geologising across the Scottish highlands." },
    ]);

    const prov = await traceClaim({
      article: "Subject",
      phrase: "geologising across the Scottish highlands",
      fetchJson,
    });

    // The prior sentence shares only the year 1838 — genealogy must NOT claim it as the origin.
    expect(prov.verdict.readings).toBeUndefined();
    const intro = prov.timeline.find((e) => e.kind === "claim-introduced");
    expect(intro?.note ?? "").toMatch(/low lexical overlap/i);
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
