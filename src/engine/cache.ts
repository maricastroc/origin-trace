import type { RevisionList } from "./wikipedia.ts";

export interface EngineCache {
  getContent(lang: string, revid: number): Promise<string | null | undefined>;
  setContent(lang: string, revid: number, value: string | null): Promise<void>;
  getList(lang: string, title: string): Promise<RevisionList | undefined>;
  setList(lang: string, title: string, value: RevisionList): Promise<void>;
}

class LruEngineCache implements EngineCache {
  private readonly content = new Map<string, string | null>();
  private readonly list = new Map<
    string,
    { at: number; value: RevisionList }
  >();

  private readonly maxContent: number;
  private readonly listTtlMs: number;

  constructor(maxContent = 4000, listTtlMs = 10 * 60_000) {
    this.maxContent = maxContent;
    this.listTtlMs = listTtlMs;
  }

  async getContent(
    lang: string,
    revid: number,
  ): Promise<string | null | undefined> {
    const key = `${lang}:${revid}`;
    if (!this.content.has(key)) return undefined;
    const value = this.content.get(key) as string | null;
    this.content.delete(key);
    this.content.set(key, value);
    return value;
  }

  async setContent(
    lang: string,
    revid: number,
    value: string | null,
  ): Promise<void> {
    const key = `${lang}:${revid}`;
    this.content.delete(key);
    this.content.set(key, value);
    if (this.content.size > this.maxContent) {
      const oldest = this.content.keys().next().value;
      if (oldest !== undefined) this.content.delete(oldest);
    }
  }

  async getList(
    lang: string,
    title: string,
  ): Promise<RevisionList | undefined> {
    const key = `${lang}:${title}`;
    const hit = this.list.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.listTtlMs) {
      this.list.delete(key);
      return undefined;
    }
    return hit.value;
  }

  async setList(
    lang: string,
    title: string,
    value: RevisionList,
  ): Promise<void> {
    this.list.set(`${lang}:${title}`, { at: Date.now(), value });
  }
}

export function createEngineCache(
  maxContent?: number,
  listTtlMs?: number,
): EngineCache {
  return new LruEngineCache(maxContent, listTtlMs);
}

export function tieredCache(l1: EngineCache, l2: EngineCache): EngineCache {
  return {
    async getContent(lang, revid) {
      const near = await l1.getContent(lang, revid);
      if (near !== undefined) return near;
      const far = await l2.getContent(lang, revid);
      if (far !== undefined) await l1.setContent(lang, revid, far);
      return far;
    },
    async setContent(lang, revid, value) {
      await Promise.all([
        l1.setContent(lang, revid, value),
        l2.setContent(lang, revid, value),
      ]);
    },
    async getList(lang, title) {
      const near = await l1.getList(lang, title);
      if (near !== undefined) return near;
      const far = await l2.getList(lang, title);
      if (far !== undefined) await l1.setList(lang, title, far);
      return far;
    },
    async setList(lang, title, value) {
      await Promise.all([
        l1.setList(lang, title, value),
        l2.setList(lang, title, value),
      ]);
    },
  };
}

export function listOnlyTiered(l1: EngineCache, l2: EngineCache): EngineCache {
  return {
    getContent: (lang, revid) => l1.getContent(lang, revid),
    setContent: (lang, revid, value) => l1.setContent(lang, revid, value),
    async getList(lang, title) {
      const near = await l1.getList(lang, title);
      if (near !== undefined) return near;
      const far = await l2.getList(lang, title);
      if (far !== undefined) await l1.setList(lang, title, far);
      return far;
    },
    async setList(lang, title, value) {
      await Promise.all([
        l1.setList(lang, title, value),
        l2.setList(lang, title, value),
      ]);
    },
  };
}

export const sharedEngineCache: EngineCache = new LruEngineCache();
