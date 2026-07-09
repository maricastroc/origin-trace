import { describe, expect, it, vi } from "vitest";
import {
  WikipediaClient,
  mergeRevisions,
  planTimeWindows,
  type FetchJson,
} from "@/engine/wikipedia.ts";

interface Rev {
  revid: number;
  parentid: number;
  timestamp: string;
  comment: string;
}

/** A faithful-enough MediaWiki `prop=revisions` mock: it honours rvdir, the
 *  inclusive rvstart/rvend timestamp bounds, rvlimit paging, and an rvcontinue
 *  offset — everything the windowed lister leans on. Backed by a fixed, globally
 *  ordered history so a test can assert an exact revid sequence. */
function mockApi(history: Rev[], pageSize = 500) {
  // Canonical order the real API would return for rvdir=newer: (timestamp, revid).
  const ordered = [...history].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.revid - b.revid,
  );
  const newest = ordered[ordered.length - 1];

  const fetchJson: FetchJson = async (url) => {
    const p = new URL(url).searchParams;

    // Latest-timestamp probe: rvdir=older, rvlimit=1.
    if (p.get("rvdir") === "older" && p.get("rvlimit") === "1") {
      return { query: { pages: [{ revisions: [{ revid: newest.revid, timestamp: newest.timestamp }] }] } };
    }

    const start = p.get("rvstart"); // older bound, inclusive
    const end = p.get("rvend"); // newer bound, inclusive
    const window = ordered.filter(
      (r) => (!start || r.timestamp >= start) && (!end || r.timestamp <= end),
    );

    const offset = p.get("rvcontinue") ? Number(p.get("rvcontinue")) : 0;
    const slice = window.slice(offset, offset + pageSize);
    const nextOffset = offset + pageSize;
    const res: {
      query: { pages: { revisions: Rev[] }[] };
      continue?: { rvcontinue: string };
    } = { query: { pages: [{ revisions: slice }] } };
    if (nextOffset < window.length) res.continue = { rvcontinue: String(nextOffset) };
    return res;
  };

  return { fetchJson, ordered };
}

/** Reference implementation: exactly the old serial algorithm — page rvdir=newer
 *  from the start following rvcontinue, no windowing. This is the ground truth the
 *  windowed lister must reproduce. */
async function serialRevids(fetchJson: FetchJson, maxPages = 1000): Promise<number[]> {
  const out: number[] = [];
  let rvcontinue: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: "X",
      rvprop: "ids|timestamp|comment",
      rvlimit: "max",
      rvdir: "newer",
    });
    if (rvcontinue) params.set("rvcontinue", rvcontinue);
    const data = (await fetchJson(`https://x/w/api.php?${params}`)) as {
      query?: { pages?: { revisions?: Rev[] }[] };
      continue?: { rvcontinue?: string };
    };
    for (const r of data.query?.pages?.[0]?.revisions ?? []) out.push(r.revid);
    rvcontinue = data.continue?.rvcontinue;
    pages += 1;
  } while (rvcontinue && pages < maxPages);
  return out;
}

/** Build `count` revisions across `years`, tie-breaking with clusters of revisions
 *  that share a timestamp — the exact hazard for window boundaries. Timestamps are
 *  spaced so several fall on the same instant every `clusterEvery` revisions. */
function synthHistory(count: number, clusterEvery = 7): Rev[] {
  const base = Date.parse("2005-01-01T00:00:00Z");
  const revs: Rev[] = [];
  for (let i = 0; i < count; i++) {
    // Advance time only between clusters, so `clusterEvery` consecutive revids
    // share a timestamp — stressing dedupe/order at any boundary that lands there.
    const step = Math.floor(i / clusterEvery);
    const ms = base + step * 6 * 60 * 60 * 1000; // 6h between clusters
    revs.push({
      revid: 1000 + i,
      parentid: i === 0 ? 0 : 999 + i,
      timestamp: new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"),
      comment: `edit ${i}`,
    });
  }
  return revs;
}

describe("windowed listRevisions ≡ serial listRevisions", () => {
  it("recovers the exact same revision set and order for a long history", async () => {
    const history = synthHistory(2600); // > pageSize, forces multi-page + windowing
    const { fetchJson } = mockApi(history);
    const spy = vi.fn(fetchJson);
    const client = new WikipediaClient({ fetchJson: spy });

    const windowed = (await client.listRevisions("X")).revisions;
    const serial = await serialRevids(fetchJson);

    // Same set, same order — the core guarantee.
    expect(windowed.map((r) => r.revid)).toEqual(serial);
    // No duplicates survived the boundary overlaps.
    expect(new Set(windowed.map((r) => r.revid)).size).toBe(windowed.length);
    // Nothing lost: every synthesized revision is present.
    expect(windowed.length).toBe(history.length);
    // It genuinely went parallel/windowed, not silently serial.
    expect(spy.mock.calls.length).toBeGreaterThan(2);
  });

  it("carries full revision metadata through the merge, oldest-first", async () => {
    const history = synthHistory(1500);
    const { fetchJson } = mockApi(history);
    const client = new WikipediaClient({ fetchJson });
    const { revisions } = await client.listRevisions("X");

    expect(revisions[0].revid).toBe(history[0].revid);
    expect(revisions[0].comment).toBe("edit 0");
    expect(revisions.at(-1)!.revid).toBe(history.at(-1)!.revid);
    // Strictly non-decreasing timestamps (the ordering trace/blame depend on).
    for (let i = 1; i < revisions.length; i++) {
      expect(revisions[i].timestamp >= revisions[i - 1].timestamp).toBe(true);
    }
  });

  it("matches serial even when a window boundary splits a same-timestamp cluster", async () => {
    // Dense clusters (10 revs/instant) maximise the chance a computed boundary lands
    // mid-cluster; the union+dedupe must still equal serial exactly.
    const history = synthHistory(3000, 10);
    const { fetchJson } = mockApi(history);
    const client = new WikipediaClient({ fetchJson });

    const windowed = (await client.listRevisions("X")).revisions.map((r) => r.revid);
    const serial = await serialRevids(fetchJson);
    expect(windowed).toEqual(serial);
  });

  it("stays serial (single request) for a short history", async () => {
    const history = synthHistory(120); // fits in one 500-rev page
    const { fetchJson } = mockApi(history);
    const spy = vi.fn(fetchJson);
    const client = new WikipediaClient({ fetchJson: spy });

    const { revisions } = await client.listRevisions("X");
    expect(revisions.map((r) => r.revid)).toEqual(await serialRevids(fetchJson));
    expect(spy).toHaveBeenCalledTimes(1); // no probe, no windows — one round-trip
  });
});

describe("planTimeWindows", () => {
  it("covers the span contiguously with boundaries shared between neighbours", () => {
    const w = planTimeWindows("2005-01-01T00:00:00Z", "2020-01-01T00:00:00Z", 12);
    expect(w.length).toBeGreaterThan(1);
    expect(w[0].start).toBe("2005-01-01T00:00:00Z");
    expect(w.at(-1)!.end).toBe("2020-01-01T00:00:00Z");
    // No gaps: each window starts exactly where the previous ended (overlap-by-seam).
    for (let i = 1; i < w.length; i++) {
      expect(w[i].start).toBe(w[i - 1].end);
    }
    // Recent-biased: the last (newest) window spans less time than the first.
    const span = (x: { start: string; end: string }) =>
      Date.parse(x.end) - Date.parse(x.start);
    expect(span(w.at(-1)!)).toBeLessThan(span(w[0]));
  });

  it("returns [] for an empty or inverted span so the caller finishes serially", () => {
    expect(planTimeWindows("2020-01-01T00:00:00Z", "2020-01-01T00:00:00Z", 12)).toEqual([]);
    expect(planTimeWindows("2021-01-01T00:00:00Z", "2020-01-01T00:00:00Z", 12)).toEqual([]);
    expect(planTimeWindows("not-a-date", "2020", 12)).toEqual([]);
  });
});

describe("mergeRevisions", () => {
  it("dedupes overlapping batches and sorts by (timestamp, revid)", () => {
    const a = [
      { revid: 3, parentid: 2, timestamp: "2020", minor: false },
      { revid: 1, parentid: 0, timestamp: "2019", minor: false },
    ];
    const b = [
      { revid: 1, parentid: 0, timestamp: "2019", minor: false }, // dup across batches
      { revid: 2, parentid: 1, timestamp: "2019", minor: false }, // same ts, tie-break by id
    ];
    const { revisions, truncated } = mergeRevisions([a, b], false);
    expect(revisions.map((r) => r.revid)).toEqual([1, 2, 3]);
    expect(truncated).toBe(false);
  });
});
