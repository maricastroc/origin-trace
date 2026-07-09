import {
  createEngineCache,
  sharedEngineCache,
  tieredCache,
  type EngineCache,
} from "./cache.ts";
import { redisCacheFromEnv } from "./redis-cache.ts";

let resolved: EngineCache | undefined;

/** The cache the API routes should use. When a Redis/KV store is configured it
 *  returns an in-process L1 fronting the persistent L2, so a warm instance stays
 *  fast and a cold one still reuses revisions cached by earlier requests. With no
 *  store configured it degrades to the shared in-memory cache — dev, CLI, and
 *  tests need zero setup. Resolved once and memoized for the process lifetime. */
export function getEngineCache(): EngineCache {
  if (resolved) return resolved;
  const redis = redisCacheFromEnv();
  resolved = redis
    ? tieredCache(createEngineCache(), redis)
    : sharedEngineCache;
  return resolved;
}
