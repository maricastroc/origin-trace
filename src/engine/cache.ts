/**
 * Process-wide cache for the live engine.
 *
 * Wikipedia history is append-only, so a revision's wikitext is immutable — we
 * cache it by revid forever (bounded LRU). The revision *list* can grow (new
 * edits land), so it gets a short TTL: stale enough to be fast on repeat traces,
 * fresh enough that "current revision" reads stay honest.
 *
 * Caching is opt-in via WikipediaClient's `cache` option. The unit-test path
 * injects a `fetchJson` transport and no cache, so fixtures stay deterministic
 * and never collide across tests.
 */
import type { RevisionList } from "./wikipedia.ts";

export interface EngineCache {
  /** `undefined` = miss; `null` = cached-known-absent. */
  getContent(lang: string, revid: number): string | null | undefined;
  setContent(lang: string, revid: number, value: string | null): void;
  getList(lang: string, title: string): RevisionList | undefined;
  setList(lang: string, title: string, value: RevisionList): void;
}

class LruEngineCache implements EngineCache {
  // Map preserves insertion order → oldest key is first. We re-insert on read
  // to bump recency, and evict from the front when over capacity.
  private readonly content = new Map<string, string | null>();
  private readonly list = new Map<string, { at: number; value: RevisionList }>();

  constructor(
    private readonly maxContent = 4000,
    private readonly listTtlMs = 10 * 60_000,
  ) {}

  getContent(lang: string, revid: number): string | null | undefined {
    const key = `${lang}:${revid}`;
    if (!this.content.has(key)) return undefined;
    const value = this.content.get(key) as string | null;
    this.content.delete(key);
    this.content.set(key, value); // bump recency
    return value;
  }

  setContent(lang: string, revid: number, value: string | null): void {
    const key = `${lang}:${revid}`;
    this.content.delete(key);
    this.content.set(key, value);
    if (this.content.size > this.maxContent) {
      const oldest = this.content.keys().next().value;
      if (oldest !== undefined) this.content.delete(oldest);
    }
  }

  getList(lang: string, title: string): RevisionList | undefined {
    const key = `${lang}:${title}`;
    const hit = this.list.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.listTtlMs) {
      this.list.delete(key);
      return undefined;
    }
    return hit.value;
  }

  setList(lang: string, title: string, value: RevisionList): void {
    this.list.set(`${lang}:${title}`, { at: Date.now(), value });
  }
}

export function createEngineCache(
  maxContent?: number,
  listTtlMs?: number,
): EngineCache {
  return new LruEngineCache(maxContent, listTtlMs);
}

/** Shared across requests — the live API routes point here. */
export const sharedEngineCache: EngineCache = new LruEngineCache();
