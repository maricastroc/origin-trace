import { describe, expect, it } from "vitest";
import {
  ClaimNotFoundError,
  SearchIncompleteError,
  traceClaim,
} from "@/engine/trace.ts";
import { fakeWiki, type FakeRevision } from "@/test/fakeWiki";
import type { FetchJson } from "@/engine/wikipedia.ts";

const PHRASE = "happiest animal";
const WITH = `The quokka is known as the ${PHRASE} in the world.`;
const WITHOUT = "The quokka is a small macropod found in Western Australia.";

function history(count: number, from: number): FakeRevision[] {
  return Array.from({ length: count }, (_, i) => ({
    revid: 1000 + i,
    timestamp: `20${String(4 + Math.floor(i / 12)).padStart(2, "0")}-${String(
      (i % 12) + 1,
    ).padStart(2, "0")}-01T00:00:00Z`,
    content: i >= from ? WITH : WITHOUT,
  }));
}

function clockedWiki(revisions: FakeRevision[], msPerContentCall: number) {
  const base = fakeWiki({ title: "Subject", revisions }).fetchJson;
  let t = 0;
  const fetchJson: FetchJson = async (url) => {
    if (new URL(url).searchParams.get("revids")) t += msPerContentCall;
    return base(url);
  };
  return { fetchJson, now: () => t };
}

const revisions = history(64, 32);

describe("search budget", () => {
  it("reports a complete descent when the budget is generous", async () => {
    const { fetchJson, now } = clockedWiki(revisions, 1);

    const result = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson,
      now,
      searchBudgetMs: 1_000_000,
    });

    expect(result.search?.searchTruncated).toBe(false);
    expect(result.search?.stopReason).toBe("complete");
    expect(result.search?.originRevId).toBe(1032);
    expect(result.meta.corpus?.searchTruncated).toBe(false);
    expect(result.verdict.confidenceReasons ?? []).not.toContain(
      "the search stopped on its time budget before finishing the descent — the origin shown is confirmed, but the range below it is only partly examined",
    );
  });

  it("produces the same origin with and without a budget", async () => {
    const withBudget = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson: clockedWiki(revisions, 1).fetchJson,
      now: clockedWiki(revisions, 1).now,
      searchBudgetMs: 1_000_000,
    });
    const withNone = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson: fakeWiki({ title: "Subject", revisions }).fetchJson,
      searchBudgetMs: Number.POSITIVE_INFINITY,
    });

    expect(withBudget.search?.originRevId).toBe(withNone.search?.originRevId);
    expect(withBudget.verdict.primary).toBe(withNone.verdict.primary);
  });

  it("stops on the budget and says so, rather than running to the wall", async () => {
    const { fetchJson, now } = clockedWiki(revisions, 1_000);

    const result = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson,
      now,
      searchBudgetMs: 2_500,
    });

    expect(result.search?.searchTruncated).toBe(true);
    expect(result.search?.stopReason).toBe("budget-exhausted");
    expect(result.meta.corpus?.searchTruncated).toBe(true);
  });

  it("keeps the partial result sound: the origin it reports really contains the phrase", async () => {
    const { fetchJson, now } = clockedWiki(revisions, 1_000);

    const result = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson,
      now,
      searchBudgetMs: 2_500,
    });

    const index = result.search!.originIndex;
    expect(index).toBeGreaterThanOrEqual(32);
    expect(result.search!.originRevId).toBe(revisions[index].revid);
    expect(result.search!.searchedRevisions).toBeGreaterThan(0);
    expect(result.search!.totalCandidateRevisions).toBe(64);
  });

  it("never claims a proven origin from a truncated descent", async () => {
    const { fetchJson, now } = clockedWiki(revisions, 1_000);

    const result = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson,
      now,
      searchBudgetMs: 2_500,
    });

    expect(result.search?.originProven).toBe(false);
    expect(result.meta.corpus?.originProven).toBe(false);
    expect(result.verdict.confidenceReasons).toContain(
      "the search stopped on its time budget before finishing the descent — the origin shown is confirmed, but the range below it is only partly examined",
    );
  });

  it("refuses to call an unfinished search a not-found", async () => {
    const { fetchJson, now } = clockedWiki(revisions, 1_000);

    const err = await traceClaim({
      article: "Subject",
      phrase: PHRASE,
      fetchJson,
      now,
      searchBudgetMs: 0,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(SearchIncompleteError);
    expect(err).not.toBeInstanceOf(ClaimNotFoundError);
    expect(err.stopReason).toBe("budget-exhausted");
    expect(err.totalCandidateRevisions).toBe(64);
  });

  it("still reports a genuine not-found as not-found", async () => {
    const { fetchJson, now } = clockedWiki(revisions, 1);

    const err = await traceClaim({
      article: "Subject",
      phrase: "a phrase that was never in this article",
      fetchJson,
      now,
      searchBudgetMs: 1_000_000,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ClaimNotFoundError);
    expect(err).not.toBeInstanceOf(SearchIncompleteError);
  });
});
