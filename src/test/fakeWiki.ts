import type { FetchJson } from "@/engine/wikipedia.ts";

export interface FakeRevision {
  revid: number;
  timestamp: string;
  content: string;
  parentid?: number;
}

export interface FakeWikiOptions {
  /** The one title the fake knows about; any other title reads as missing. */
  title: string;
  /** Chronological order, oldest first (matches rvdir=newer listing). */
  revisions: FakeRevision[];
  /** Search results keyed by the exact srsearch query string. */
  search?: Record<string, { title: string; snippet?: string }[]>;
}

export interface FakeWiki {
  fetchJson: FetchJson;
  calls: { list: number; content: number; current: number; search: number };
}

/**
 * A minimal in-memory stand-in for the MediaWiki API, routing by query params
 * the same way {@link WikipediaClient} builds them. Enough to exercise
 * listRevisions / getContent / getCurrentContent / search end to end.
 */
export function fakeWiki(opts: FakeWikiOptions): FakeWiki {
  const byId = new Map(opts.revisions.map((r) => [r.revid, r]));
  const calls = { list: 0, content: 0, current: 0, search: 0 };

  const fetchJson: FetchJson = async (url) => {
    const p = new URL(url).searchParams;

    if (p.get("list") === "search") {
      calls.search += 1;
      const hits = opts.search?.[p.get("srsearch") ?? ""] ?? [];
      return { query: { search: hits } };
    }

    const revids = p.get("revids");
    if (revids) {
      calls.content += 1;
      const revisions = revids
        .split("|")
        .map(Number)
        .filter((id) => byId.has(id))
        .map((id) => {
          const r = byId.get(id)!;
          return { revid: r.revid, slots: { main: { content: r.content } } };
        });
      return { query: { pages: [{ revisions }] } };
    }

    if (p.get("titles") !== opts.title) {
      return { query: { pages: [{ missing: true }] } };
    }

    if (p.get("rvdir") === "older") {
      calls.current += 1;
      const latest = opts.revisions[opts.revisions.length - 1];
      return {
        query: {
          pages: [
            {
              revisions: [
                {
                  revid: latest.revid,
                  timestamp: latest.timestamp,
                  slots: { main: { content: latest.content } },
                },
              ],
            },
          ],
        },
      };
    }

    calls.list += 1;
    return {
      query: {
        pages: [
          {
            revisions: opts.revisions.map((r) => ({
              revid: r.revid,
              parentid: r.parentid ?? 0,
              timestamp: r.timestamp,
            })),
          },
        ],
      },
    };
  };

  return { fetchJson, calls };
}
