import { gunzipSync, gzipSync } from "node:zlib";
import { Redis } from "@upstash/redis";
import type { EngineCache } from "./cache.ts";
import type { RevisionList } from "./wikipedia.ts";

const CONTENT_PREFIX = "ot:c";
const LIST_PREFIX = "ot:l";
const CONTENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const LIST_TTL_SECONDS = 10 * 60;
interface Wrapped<T> {
  v: T;
}

function pack<T>(value: T): string {
  return gzipSync(Buffer.from(JSON.stringify({ v: value }), "utf8")).toString(
    "base64",
  );
}

function unpack<T>(raw: string): T {
  const json = gunzipSync(Buffer.from(raw, "base64")).toString("utf8");
  return (JSON.parse(json) as Wrapped<T>).v;
}

export class RedisEngineCache implements EngineCache {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async getContent(
    lang: string,
    revid: number,
  ): Promise<string | null | undefined> {
    const raw = await this.redis.get<string>(
      `${CONTENT_PREFIX}:${lang}:${revid}`,
    );
    return raw == null ? undefined : unpack<string | null>(raw);
  }

  async setContent(
    lang: string,
    revid: number,
    value: string | null,
  ): Promise<void> {
    await this.redis.set(`${CONTENT_PREFIX}:${lang}:${revid}`, pack(value), {
      ex: CONTENT_TTL_SECONDS,
    });
  }

  async getList(
    lang: string,
    title: string,
  ): Promise<RevisionList | undefined> {
    const raw = await this.redis.get<string>(`${LIST_PREFIX}:${lang}:${title}`);
    return raw == null ? undefined : unpack<RevisionList>(raw);
  }

  async setList(
    lang: string,
    title: string,
    value: RevisionList,
  ): Promise<void> {
    await this.redis.set(`${LIST_PREFIX}:${lang}:${title}`, pack(value), {
      ex: LIST_TTL_SECONDS,
    });
  }
}

export function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  return new Redis({ url, token, retry: false });
}

export function redisCacheFromEnv(): RedisEngineCache | null {
  const redis = redisFromEnv();
  return redis ? new RedisEngineCache(redis) : null;
}
