import type { RevisionList } from "./wikipedia.ts";

export interface EngineCache {
  getContent(lang: string, revid: number): string | null | undefined;
  setContent(lang: string, revid: number, value: string | null): void;
  getList(lang: string, title: string): RevisionList | undefined;
  setList(lang: string, title: string, value: RevisionList): void;
}

class LruEngineCache implements EngineCache {
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
    this.content.set(key, value);
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

export const sharedEngineCache: EngineCache = new LruEngineCache();
