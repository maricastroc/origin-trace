import { describe, expect, it } from "vitest";
import { resolveArticles } from "@/engine/resolve.ts";
import { fakeWiki } from "@/test/fakeWiki";

function searcher(search: Record<string, { title: string; snippet?: string }[]>) {
  return fakeWiki({ title: "unused", revisions: [], search }).fetchJson;
}

describe("resolveArticles", () => {
  it("resolves unambiguously when exactly one article contains the phrase verbatim", async () => {
    const fetchJson = searcher({
      'insource:"the happiest animal"': [{ title: "Quokka", snippet: "…the happiest…" }],
      "the happiest animal": [
        { title: "Quokka", snippet: "…" },
        { title: "Setonix", snippet: "…" },
      ],
    });

    const res = await resolveArticles("the happiest animal", { fetchJson });
    expect(res.scope).toBe("unambiguous");
    expect(res.resolved).toBe("Quokka");
    // exact match should rank ahead of the fuzzy-only candidate
    expect(res.candidates[0].title).toBe("Quokka");
    expect(res.candidates[0].exactWikitextMatch).toBe(true);
  });

  it("is ambiguous when the phrase appears verbatim in multiple articles", async () => {
    const fetchJson = searcher({
      'insource:"brazilian aardvark"': [
        { title: "Coati" },
        { title: "List of hoaxes" },
      ],
      "brazilian aardvark": [{ title: "Coati" }],
    });

    const res = await resolveArticles("brazilian aardvark", { fetchJson });
    expect(res.scope).toBe("ambiguous");
    expect(res.resolved).toBeNull();
  });

  it("is ambiguous (drifted wording) when only fuzzy matches exist", async () => {
    const fetchJson = searcher({
      'insource:"vanished phrase"': [],
      "vanished phrase": [{ title: "Something Close" }],
    });

    const res = await resolveArticles("vanished phrase", { fetchJson });
    expect(res.scope).toBe("ambiguous");
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].exactWikitextMatch).toBe(false);
  });

  it("is not-found when nothing matches at all", async () => {
    const fetchJson = searcher({ 'insource:"nothing"': [], nothing: [] });
    const res = await resolveArticles("nothing", { fetchJson });
    expect(res.scope).toBe("not-found");
    expect(res.candidates).toEqual([]);
  });

  it("strips quotes from the phrase before building the insource query", async () => {
    const fetchJson = searcher({
      'insource:"quoted phrase"': [{ title: "Article" }],
      "quoted phrase": [{ title: "Article" }],
    });
    const res = await resolveArticles('"quoted phrase"', { fetchJson });
    expect(res.scope).toBe("unambiguous");
    expect(res.resolved).toBe("Article");
  });
});
