import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { Redis } from "@upstash/redis";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { normalize } from "./blame.ts";
import {
  readOutcome,
  type Breaker,
  type CacheObserver,
} from "./cache-guard.ts";

const RESULT_PREFIX = "ot:r";

export const RESULT_CACHE_VERSION = "v1";

const RESULT_TTL_SECONDS = 7 * 24 * 60 * 60;

export function normalizeTitle(title: string): string {
  const collapsed = title.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}

export function traceCacheKey(input: {
  lang: string;
  article: string;
  headRevid: number;
  phrase: string;
  claimText?: string;
  maxPages?: number;
  searchBudgetMs?: number;
}): string {
  const material = [
    RESULT_CACHE_VERSION,
    normalize(input.phrase),
    normalize(input.claimText ?? ""),
    String(input.maxPages ?? ""),
    String(input.searchBudgetMs ?? ""),
  ].join(" ");

  const digest = createHash("sha256")
    .update(material, "utf8")
    .digest("hex")
    .slice(0, 16);

  return [
    RESULT_PREFIX,
    RESULT_CACHE_VERSION,
    input.lang,
    normalizeTitle(input.article),
    input.headRevid,
    digest,
  ].join(":");
}

export interface ResultStore {
  get(key: string): Promise<ClaimProvenance | undefined>;
  set(key: string, value: ClaimProvenance): Promise<void>;
}

export function redisResultStore(redis: Redis): ResultStore {
  return {
    async get(key) {
      const raw = await redis.get<string>(key);
      if (raw == null) return undefined;
      return JSON.parse(
        gunzipSync(Buffer.from(raw, "base64")).toString("utf8"),
      ) as ClaimProvenance;
    },
    async set(key, value) {
      const packed = gzipSync(
        Buffer.from(JSON.stringify(value), "utf8"),
      ).toString("base64");
      await redis.set(key, packed, { ex: RESULT_TTL_SECONDS });
    },
  };
}

export function guardedResultStore(
  inner: ResultStore,
  breaker: Breaker,
  observe?: CacheObserver,
): ResultStore {
  return {
    get(key) {
      return breaker.run<ClaimProvenance | undefined>(
        "result",
        "read",
        () => inner.get(key),
        undefined,
        readOutcome,
        observe,
      );
    },
    set(key, value) {
      return breaker.run(
        "result",
        "write",
        () => inner.set(key, value),
        undefined,
        () => "ok",
        observe,
      );
    },
  };
}
