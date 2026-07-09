import { describe, expect, it } from "vitest";
import { parseArticleInput } from "./articleInput.ts";

describe("parseArticleInput", () => {
  it("passes a bare title through untouched", () => {
    expect(parseArticleInput("Neymar")).toEqual({ title: "Neymar" });
  });

  it("keeps multi-word titles as typed", () => {
    expect(parseArticleInput("  Animal Farm ")).toEqual({
      title: "Animal Farm",
    });
  });

  it("extracts title and language from a full URL", () => {
    expect(parseArticleInput("https://pt.wikipedia.org/wiki/Neymar")).toEqual({
      title: "Neymar",
      lang: "pt",
    });
  });

  it("turns underscores into spaces", () => {
    expect(
      parseArticleInput("https://en.wikipedia.org/wiki/Animal_Farm"),
    ).toEqual({
      title: "Animal Farm",
      lang: "en",
    });
  });

  it("decodes percent-encoded titles", () => {
    expect(
      parseArticleInput("https://es.wikipedia.org/wiki/S%C3%A3o_Paulo"),
    ).toEqual({
      title: "São Paulo",
      lang: "es",
    });
  });

  it("drops section anchors and query strings", () => {
    expect(
      parseArticleInput(
        "https://en.wikipedia.org/wiki/Whale?action=history#Diet",
      ),
    ).toEqual({ title: "Whale", lang: "en" });
  });

  it("handles protocol-less and mobile hosts", () => {
    expect(parseArticleInput("pt.m.wikipedia.org/wiki/Pel%C3%A9")).toEqual({
      title: "Pelé",
      lang: "pt",
    });
  });

  it("leaves a non-wikipedia URL as a literal title", () => {
    expect(parseArticleInput("https://example.com/wiki/Neymar")).toEqual({
      title: "https://example.com/wiki/Neymar",
    });
  });
});
