import { gunzipSync, gzipSync } from "node:zlib";
import { Redis } from "@upstash/redis";
import type { EngineCache } from "./cache.ts";
import type { RevisionList } from "./wikipedia.ts";

const CONTENT_PREFIX = "ot:c";
const LIST_PREFIX = "ot:l";
// Revision content is immutable, so it never changes — but a long TTL still bounds
// total store growth (a cold-evicted revision is cheap to refetch). Revision lists
// grow at the tail as new edits land, so they carry a much shorter TTL.
const CONTENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const LIST_TTL_SECONDS = 10 * 60;

// Everything is gzipped before storage: the metadata-heavy revision list compresses
// ~5x (1.8 MB → 400 KB for a 12k-revision article), which is what keeps it under
// Upstash's 1 MB request ceiling; article wikitext roughly halves. The value is also
// wrapped as `{ v }` so a stored `null` (a known-empty revision) survives as a real
// object while a genuine miss comes back as `null` from Redis — the two must differ.
interface Wrapped<T> {
  v: T;
}

function pack<T>(value: T): string {
  return gzipSync(Buffer.from(JSON.stringify({ v: value }), "utf8")).toString("base64");
}

function unpack<T>(raw: string): T {
  const json = gunzipSync(Buffer.from(raw, "base64")).toString("utf8");
  return (JSON.parse(json) as Wrapped<T>).v;
}

let warned = false;
function swallow(err: unknown): void {
  if (!warned) {
    warned = true;
    console.warn("[origin-trace] Redis cache unavailable, falling back to network:", err);
  }
}

/** A persistent {@link EngineCache} backed by Upstash Redis (HTTP/REST, so it
 *  survives the serverless cold starts that evaporate the in-process cache). Values
 *  are gzipped to fit request limits and cut storage. Every operation is best-effort:
 *  a Redis error degrades to a cache miss / no-op and the trace still completes
 *  against the live Wikipedia API. */
export class RedisEngineCache implements EngineCache {
  constructor(private readonly redis: Redis) {}

  async getContent(lang: string, revid: number): Promise<string | null | undefined> {
    try {
      const raw = await this.redis.get<string>(`${CONTENT_PREFIX}:${lang}:${revid}`);
      return raw == null ? undefined : unpack<string | null>(raw);
    } catch (err) {
      swallow(err);
      return undefined;
    }
  }

  async setContent(lang: string, revid: number, value: string | null): Promise<void> {
    try {
      await this.redis.set(`${CONTENT_PREFIX}:${lang}:${revid}`, pack(value), {
        ex: CONTENT_TTL_SECONDS,
      });
    } catch (err) {
      swallow(err);
    }
  }

  async getList(lang: string, title: string): Promise<RevisionList | undefined> {
    try {
      const raw = await this.redis.get<string>(`${LIST_PREFIX}:${lang}:${title}`);
      return raw == null ? undefined : unpack<RevisionList>(raw);
    } catch (err) {
      swallow(err);
      return undefined;
    }
  }

  async setList(lang: string, title: string, value: RevisionList): Promise<void> {
    try {
      await this.redis.set(`${LIST_PREFIX}:${lang}:${title}`, pack(value), {
        ex: LIST_TTL_SECONDS,
      });
    } catch (err) {
      swallow(err);
    }
  }
}

/** Build a Redis-backed cache from the environment, or `null` when no store is
 *  configured. Reads both the Upstash and Vercel KV env conventions so the same
 *  code works on either host without a shim. */
export function redisCacheFromEnv(): RedisEngineCache | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new RedisEngineCache(new Redis({ url, token }));
}
