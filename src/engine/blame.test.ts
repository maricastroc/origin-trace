import { describe, expect, it } from "vitest";
import {
  anchorIndex,
  classifyInline,
  collectMarkers,
  containsPhrase,
  detectRefNear,
  findIntroduction,
  maskedRanges,
  normalize,
  parseCitation,
  parseShortFootnote,
  type ContentReader,
} from "@/engine/blame.ts";
import type { RevisionMeta } from "@/engine/wikipedia.ts";

import type { SearchProbe } from "@/types/SearchProbe";

function rev(i: number): RevisionMeta {
  return {
    revid: 100 + i,
    parentid: i === 0 ? 0 : 99 + i,
    timestamp: `${2010 + i}-03-01T00:00:00Z`,
    minor: false,
  };
}

function corpus(has: boolean[], phrase = "the target phrase") {
  const revisions = has.map((_, i) => rev(i));

  const byId = new Map<number, string>();
  has.forEach((hit, i) => {
    byId.set(
      revisions[i].revid,
      hit ? `intro text. ${phrase}. tail.` : "unrelated prose only.",
    );
  });

  const reads: number[] = [];

  const getContent: ContentReader = async (revid) => {
    reads.push(revid);
    return byId.get(revid) ?? null;
  };

  return { revisions, getContent, reads, phrase };
}

function batchedCorpus(has: boolean[], phrase = "the target phrase") {
  const revisions = has.map((_, i) => rev(i));

  const byId = new Map<number, string>();
  has.forEach((hit, i) => {
    byId.set(
      revisions[i].revid,
      hit ? `intro text. ${phrase}. tail.` : "unrelated prose only.",
    );
  });

  const warm = new Map<number, string | null>();

  let roundTrips = 0;

  const getContent: ContentReader = async (revid) => {
    if (warm.has(revid)) return warm.get(revid)!;
    roundTrips += 1;
    const c = byId.get(revid) ?? null;
    warm.set(revid, c);
    return c;
  };

  getContent.prefetch = async (revids) => {
    const missing = revids.filter((r) => !warm.has(r));
    if (missing.length === 0) return;
    roundTrips += 1;
    for (const r of missing) warm.set(r, byId.get(r) ?? null);
  };
  return { revisions, getContent, phrase, roundTrips: () => roundTrips };
}

describe("normalize / containsPhrase", () => {
  it("lowercases, strips markup, and collapses whitespace", () => {
    expect(normalize("The  <b>Quokka</b> is\n[[Australia|here]]!")).toBe(
      "the quokka is here",
    );
  });

  it("ignores <ref> content when normalizing", () => {
    expect(normalize("A claim<ref>{{cite web|title=X}}</ref> stands")).toBe(
      "a claim stands",
    );
  });

  it("containsPhrase matches across markup and casing differences", () => {
    expect(
      containsPhrase(
        "The '''Quokka''' is a [[marsupial]].",
        "quokka is a marsupial",
      ),
    ).toBe(true);
    expect(containsPhrase("A different sentence.", "quokka")).toBe(false);
  });

  it("unwraps inline formatting templates so a rendered phrase still matches", () => {
    expect(
      containsPhrase(
        "Five {{em|strong}}, {{em|intelligent}}, {{em|beautiful}} women, five sisters.",
        "Five strong, intelligent, beautiful women, five sisters",
      ),
    ).toBe(true);
    expect(normalize("a {{lang|fr|bonjour}} b")).toBe("a bonjour b");
    expect(normalize("held{{nbsp}}together")).toBe("held together");
  });

  it("renders {{convert}}/{{cvt}} to its value so a rendered phrase matches", () => {
    expect(
      normalize("about {{convert|41200|sqkm|sqmi|abbr=on}} of the coast"),
    ).toBe("about 41200 sqkm of the coast");
    expect(normalize("a {{cvt|5|km}} walk")).toBe("a 5 km walk");
    expect(
      containsPhrase(
        "an area of about {{convert|41200|sqkm|sqmi|abbr=on}} of the South West",
        "an area of about 41200 sqkm of the South West",
      ),
    ).toBe(true);

    expect(
      containsPhrase(
        "spanning {{convert|10|to|20|km}} north",
        "spanning 10–20 km north",
      ),
    ).toBe(true);
  });

  it("resolves a labelled external link to its label", () => {
    expect(normalize("see [https://example.org/x The Report] now")).toBe(
      "see the report now",
    );
    expect(
      containsPhrase(
        "noted in [https://example.org/x the field guide] clearly",
        "noted in the field guide clearly",
      ),
    ).toBe(true);
  });
});

describe("findIntroduction", () => {
  it("returns null when the phrase never appears", async () => {
    const { revisions, getContent, phrase } = corpus([
      false,
      false,
      false,
      false,
    ]);
    expect(await findIntroduction(revisions, phrase, getContent)).toBeNull();
  });

  it("returns null for an empty revision list", async () => {
    const { getContent, phrase } = corpus([]);

    expect(await findIntroduction([], phrase, getContent)).toBeNull();
  });

  it("locates the first revision that contains the phrase (present through to now)", async () => {
    const { revisions, getContent, phrase } = corpus([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);

    const res = await findIntroduction(revisions, phrase, getContent);

    expect(res).not.toBeNull();
    expect(res!.index).toBe(3);
    expect(res!.revision.revid).toBe(103);
    expect(res!.priorRevision?.revid).toBe(102);
    expect(res!.removedSince).toBe(false);
    expect(res!.assumptionViolated).toBe(false);
  });

  it("flags removedSince when the phrase is gone from the latest revision", async () => {
    const { revisions, getContent, phrase } = corpus([
      false,
      false,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);

    const res = await findIntroduction(revisions, phrase, getContent);
    expect(res!.index).toBe(2);

    expect(res!.removedSince).toBe(true);
  });

  it("has no prior revision when the claim was born in the first revision", async () => {
    const { revisions, getContent, phrase } = corpus([true, true, true]);

    const res = await findIntroduction(revisions, phrase, getContent);

    expect(res!.index).toBe(0);
    expect(res!.priorRevision).toBeNull();
  });

  it("reads far fewer revisions than a linear scan on a large history", async () => {
    const has = Array.from({ length: 256 }, (_, i) => i >= 100);

    const { revisions, getContent, reads, phrase } = corpus(has);

    const res = await findIntroduction(revisions, phrase, getContent);

    expect(res!.index).toBe(100);

    expect(new Set(reads).size).toBeLessThan(64);
  });

  it("collapses probe sweeps into batched round-trips without changing the result", async () => {
    const has = Array.from({ length: 256 }, (_, i) => i >= 100);

    const plain = corpus(has);

    const plainRes = await findIntroduction(
      plain.revisions,
      plain.phrase,
      plain.getContent,
    );

    const plainRoundTrips = new Set(plain.reads).size;

    const batched = batchedCorpus(has);

    const batchedRes = await findIntroduction(
      batched.revisions,
      batched.phrase,
      batched.getContent,
    );

    expect(batchedRes!.index).toBe(100);

    expect(batchedRes!.index).toBe(plainRes!.index);

    expect(batched.roundTrips()).toBeLessThan(plainRoundTrips);
  });

  it("batches the lower-bound descent instead of fetching each level serially", async () => {
    const n = 4096;

    const edge = 2500;

    const has = Array.from({ length: n }, (_, i) => i >= edge);

    const plain = corpus(has);

    const plainRes = await findIntroduction(
      plain.revisions,
      plain.phrase,
      plain.getContent,
    );
    const plainRoundTrips = new Set(plain.reads).size;

    const batched = batchedCorpus(has);

    const batchedRes = await findIntroduction(
      batched.revisions,
      batched.phrase,
      batched.getContent,
    );

    expect(batchedRes!.index).toBe(edge);

    expect(batchedRes!.index).toBe(plainRes!.index);

    expect(batched.roundTrips()).toBeLessThan(plainRoundTrips / 2);
  });
});
describe("findIntroduction — adversarial guarantees", () => {
  const run = (has: boolean[]) => {
    const { revisions, getContent, phrase } = batchedCorpus(has);
    return findIntroduction(revisions, phrase, getContent);
  };
  const presentAt = (has: boolean[], i: number) => has[i] === true;

  it("finds the earliest island, not a later block, under non-monotonic presence", async () => {
    const has = [
      false,
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ];
    const res = await run(has);
    expect(res!.index).toBe(1);
    expect(presentAt(has, res!.index)).toBe(true);
    expect(res!.removedSince).toBe(false);
  });

  it("is not fooled by a removal followed by re-addition", async () => {
    const has = [false, true, true, false, false, true, true, true];
    const res = await run(has);
    expect(res!.index).toBe(1);
    expect(res!.removedSince).toBe(false);
  });

  it("detects removal of a short-lived mid-history island", async () => {
    const has = Array.from({ length: 1000 }, (_, i) => i >= 400 && i < 403);
    const res = await run(has);
    expect(res!.index).toBe(400);
    expect(presentAt(has, res!.index)).toBe(true);
    expect(res!.removedSince).toBe(true);
  });

  it("pins the exact introduction on a large monotonic history, off the sample grid", async () => {
    const has = Array.from({ length: 1000 }, (_, i) => i >= 617);
    const res = await run(has);
    expect(res!.index).toBe(617);
    expect(res!.removedSince).toBe(false);
  });

  it("resolves a first-revision origin to index 0 with no prior, despite later gaps", async () => {
    const has = [true, false, true, true, true, true, true, true];
    const res = await run(has);
    expect(res!.index).toBe(0);
    expect(res!.priorRevision).toBeNull();
  });

  it("stays sound when a narrow early island lies beyond the sample grid", async () => {
    const has = Array.from({ length: 1000 }, (_, i) => i === 3 || i >= 500);
    const res = await run(has);
    expect(presentAt(has, res!.index)).toBe(true);
    expect(res!.index).toBeLessThanOrEqual(500);
    expect(res!.removedSince).toBe(false);
    expect(res!.index).toBe(500);
  });

  it("does not raise assumptionViolated even across a non-monotonic boundary", async () => {
    const has = [false, true, false, true, false, true, false, true];
    const res = await run(has);
    expect(presentAt(has, res!.index)).toBe(true);
    expect(res!.assumptionViolated).toBe(false);
  });

  it("locates the same origin whether or not reads are prefetched", async () => {
    const has = [
      false,
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ];
    const plain = corpus(has);
    const batched = batchedCorpus(has);
    const a = await findIntroduction(
      plain.revisions,
      plain.phrase,
      plain.getContent,
    );
    const b = await findIntroduction(
      batched.revisions,
      batched.phrase,
      batched.getContent,
    );
    expect(a!.index).toBe(b!.index);
    expect(b!.index).toBe(1);
  });
});

describe("classifyInline", () => {
  it("marks a sentence with a citation ref as sourced", () => {
    const det = classifyInline(
      "The quokka is a marsupial.<ref>{{cite web|url=http://x.com|title=Y}}</ref>",
    );

    expect(det.sourced).toBe(true);

    expect(det.note).toBe(false);
  });

  it("treats a grouped ref as an explanatory note, not a source", () => {
    const det = classifyInline(
      "A stat here.<ref group=note>context only</ref>",
    );

    expect(det.sourced).toBe(false);

    expect(det.note).toBe(true);
  });

  it("treats a bare {{efn}} as a note", () => {
    const det = classifyInline("A stat here.{{efn|Just a clarification.}}");

    expect(det.sourced).toBe(false);

    expect(det.note).toBe(true);
  });

  it("treats an {{efn}} that itself wraps a citation as sourced", () => {
    const det = classifyInline(
      "A stat here.{{efn|See {{cite web|url=http://x.com|title=Y}} for detail.}}",
    );

    expect(det.sourced).toBe(true);
  });

  it("marks a plain uncited sentence as neither sourced nor noted", () => {
    const det = classifyInline("The quokka is a small marsupial.");

    expect(det).toMatchObject({ sourced: false, note: false });
  });

  it("counts a {{sfn}} shortened footnote as sourced", () => {
    const det = classifyInline(
      "Cleopatra ruled as co-regent.{{sfn|Roller|2010|p=53}}",
    );

    expect(det.sourced).toBe(true);
    expect(det.note).toBe(false);
    expect(det.source).toMatchObject({ label: "Roller", year: 2010 });
  });

  it("counts a Harvard {{harvnb}} footnote as sourced", () => {
    const det = classifyInline(
      "The date is contested.{{harvnb|Smith|Jones|1998|pp=4–7}}",
    );

    expect(det.sourced).toBe(true);

    expect(det.source).toMatchObject({ label: "Smith & Jones", year: 1998 });
  });

  it("does not confuse {{sfn}} with the note family", () => {
    const sfn = classifyInline("A claim.{{sfnp|Author|2001}}");

    const efn = classifyInline("A claim.{{efn|Just context.}}");

    expect(sfn).toMatchObject({ sourced: true, note: false });

    expect(efn).toMatchObject({ sourced: false, note: true });
  });
});

describe("collectMarkers", () => {
  it("returns markers in document order, classified by kind", () => {
    const markers = collectMarkers(
      "text.<ref group=note>n</ref> more.<ref>{{cite web|title=X}}</ref>",
      Infinity,
    );

    expect(markers.map((m) => m.kind)).toEqual(["note", "citation"]);

    expect(markers[0].index).toBeLessThan(markers[1].index);
  });

  it("ignores markers beyond the maxGap window", () => {
    const text = "sentence one. sentence two.<ref>{{cite web|title=X}}</ref>";

    expect(collectMarkers(text, 5)).toHaveLength(0);
  });
});

describe("maskedRanges", () => {
  it("covers <ref> blocks, self-closing refs and templates", () => {
    const text = "a<ref>x</ref>b{{tpl}}c<ref name=q />d";

    const ranges = maskedRanges(text);

    const spans = ranges.map(([a, b]) => text.slice(a, b)).sort();

    expect(spans).toContain("<ref>x</ref>");

    expect(spans).toContain("{{tpl}}");

    expect(spans).toContain("<ref name=q />");
  });
});

describe("parseCitation", () => {
  it("reads a {{cite news}} template into a newspaper source", () => {
    const src = parseCitation(
      "<ref>{{cite news|newspaper=The Guardian|title=Quokka selfie|date=2019-04-01}}</ref>",
    );

    expect(src).toEqual({
      label: "The Guardian",
      type: "newspaper",
      year: 2019,
    });
  });

  it("reads a {{cite journal}} template as peer-reviewed", () => {
    const src = parseCitation(
      "<ref>{{cite journal|journal=Nature|title=X}}</ref>",
    );

    expect(src).toMatchObject({ label: "Nature", type: "peer-reviewed" });
  });

  it("falls back to the hostname for a bare URL reference", () => {
    const src = parseCitation(
      "<ref>Retrieved from https://www.example.com/foo/bar today</ref>",
    );

    expect(src).toEqual({
      label: "example.com",
      type: "other",
      url: "https://www.example.com/foo/bar",
    });
  });

  it("returns null when there is no template and no URL", () => {
    expect(parseCitation("<ref>see page 42 of the manual</ref>")).toBeNull();
  });
});

describe("parseShortFootnote", () => {
  it("reads a single author and year from {{sfn}}", () => {
    expect(parseShortFootnote("{{sfn|Roller|2010|p=53}}")).toEqual({
      label: "Roller",
      type: "other",
      year: 2010,
    });
  });

  it("joins two authors and ignores named page params", () => {
    expect(
      parseShortFootnote("{{harvnb|Smith|Jones|1998|pp=4–7}}"),
    ).toMatchObject({
      label: "Smith & Jones",
      year: 1998,
    });
  });

  it("collapses three or more authors to et al.", () => {
    expect(parseShortFootnote("{{sfn|Smith|Jones|Lee|2005}}").label).toBe(
      "Smith et al.",
    );
  });

  it("tolerates a year disambiguation letter", () => {
    expect(parseShortFootnote("{{sfn|Roller|2010a|p=1}}").year).toBe(2010);
  });

  it("falls back to a generic label for the named-param {{sfnm}} form", () => {
    expect(
      parseShortFootnote("{{sfnm|1a1=Smith|1y=2004|2a1=Jones|2y=2009}}"),
    ).toEqual({
      label: "shortened footnote",
      type: "other",
    });
  });
});

describe("detectRefNear", () => {
  it("detects an inline citation attached to the sentence carrying the phrase", () => {
    const content =
      "The quokka is a small marsupial native to Australia.<ref>{{cite news|newspaper=The Guardian|title=Q|date=2019}}</ref>\n\nA later paragraph with no bearing.";

    const det = detectRefNear(content, "small marsupial native to Australia");
    expect(det.sourced).toBe(true);

    expect(det.source?.label).toBe("The Guardian");
  });

  it("detects an explanatory note as note-only, not sourced", () => {
    const content =
      "The figure is often disputed among scholars.{{efn|Estimates vary widely.}}\n\nUnrelated.";

    const det = detectRefNear(content, "often disputed among scholars");

    expect(det.sourced).toBe(false);

    expect(det.note).toBe(true);
  });

  it("detects a shortened-footnote citation on the sentence carrying the phrase", () => {
    const content =
      "Cleopatra was the last active ruler of the Ptolemaic Kingdom of Egypt.{{sfn|Roller|2010|p=1}}\n\nUnrelated paragraph.";

    const det = detectRefNear(
      content,
      "last active ruler of the Ptolemaic Kingdom",
    );

    expect(det.sourced).toBe(true);

    expect(det.source).toMatchObject({ label: "Roller", year: 2010 });
  });

  it("detects a citation hanging after a closing quote", () => {
    const content =
      'Parkes recalled, "From Edinburgh we would drive up to the family croft at [[Durness]], which was from about the time Lennon was nine years old until he was about 16."{{sfn|Harry|2000b|p=702}} His uncle George died of a liver haemorrhage.{{sfn|Harry|2000b|p=819}}';

    const det = detectRefNear(content, "the family croft at Durness");

    expect(det.sourced).toBe(true);

    expect(det.source).toMatchObject({ label: "Harry", year: 2000 });
  });

  it("does not invent a source when a quote ends the sentence uncited", () => {
    const det = detectRefNear(
      'Parkes recalled, "we drove to the croft at [[Durness]]." His uncle George died.{{sfn|Harry|2000b|p=819}}',
      "the croft at Durness",
    );

    expect(det).toMatchObject({ sourced: false, note: false, source: null });
  });

  it("attributes a blockquote's tail citation to a sentence in its middle", () => {
    const content =
      '{{blockquote|There were five women that were my family. Now those women were fantastic. I would infiltrate the other boys\' minds. I could say, "Parents are not gods."{{sfn|Sheff|2000|pp=158–59}}}}';

    const det = detectRefNear(content, "infiltrate the other boys' minds");

    expect(det.sourced).toBe(true);

    expect(det.source).toMatchObject({ label: "Sheff", year: 2000 });
  });

  it("leaves an uncited blockquote unsourced", () => {
    const det = detectRefNear(
      "{{blockquote|There were five women that were my family. I would infiltrate the other boys' minds.}}",
      "infiltrate the other boys' minds",
    );

    expect(det).toMatchObject({ sourced: false, note: false, source: null });
  });

  it("detects a citation whose quote parameter nests a template", () => {
    const content =
      'He took him on trips to local cinemas.{{sfn|Spitz|2005|p=32: "Parkes recalled{{nbsp}}[...] to the cinema three times a day"}} During the holidays they travelled.';

    const det = detectRefNear(content, "took him on trips to local cinemas");

    expect(det.sourced).toBe(true);

    expect(det.source).toMatchObject({ label: "Spitz", year: 2005 });
  });

  it("returns nothing when the phrase is absent from the content", () => {
    const det = detectRefNear(
      "Completely unrelated prose here.",
      "no such phrase",
    );

    expect(det).toMatchObject({ sourced: false, note: false, source: null });
  });
});

describe("anchorIndex", () => {
  it("finds the full phrase when present verbatim", () => {
    expect(anchorIndex("the quokka is a marsupial", "quokka is a")).toBe(4);
  });

  it("falls back to the longest word when the full phrase is absent", () => {
    const idx = anchorIndex(
      "a marsupial endemic to rottnest",
      "marsupial vanished",
    );

    expect(idx).toBe("a ".length);
  });

  it("returns -1 when nothing matches", () => {
    expect(anchorIndex("short text", "absolutely nowhere")).toBe(-1);
  });
});

describe("findIntroduction — probe descent", () => {
  const has = Array.from({ length: 40 }, (_, i) => i >= 25);

  async function descend() {
    const { revisions, getContent, phrase } = corpus(has);
    const probes: SearchProbe[] = [];
    const res = await findIntroduction(revisions, phrase, getContent, (p) =>
      probes.push(p),
    );
    return { res: res!, probes };
  }

  it("emits a probe stream that pins the true origin", async () => {
    const { res, probes } = await descend();
    expect(res.index).toBe(25);
    expect(probes.length).toBeGreaterThan(0);
  });

  it("reports every probe truthfully and inside its own window", async () => {
    const { probes } = await descend();
    probes.forEach((p, i) => {
      expect(p.step).toBe(i);
      expect(p.hit).toBe(has[p.index]);
      expect(p.lo).toBeLessThanOrEqual(p.index);
      expect(p.index).toBeLessThan(p.hi);
    });
  });

  it("samples first, then bisects toward the edge", async () => {
    const { probes } = await descend();
    const kinds = new Set(probes.map((p) => p.kind));
    expect(kinds.has("sample")).toBe(true);
    expect(kinds.has("bisect")).toBe(true);
    const bisected = probes.filter((p) => p.kind === "bisect").map((p) => p.index);
    expect(bisected).toContain(25);
    expect(bisected).toContain(24);
  });

  it("converges in O(log n) reads, not a linear scan", async () => {
    const { res } = await descend();

    expect(res.contentFetches).toBeLessThan(20);
  });

  it("stays inert when no sink is passed (no behaviour change)", async () => {
    const { revisions, getContent, phrase } = corpus(has);
    const res = await findIntroduction(revisions, phrase, getContent);
    expect(res!.index).toBe(25);
  });
});
