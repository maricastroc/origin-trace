import type { Redis } from "@upstash/redis";
import {
  createEngineCache,
  listOnlyTiered,
  sharedEngineCache,
  type EngineCache,
} from "./cache.ts";
import {
  createBreaker,
  guardedCache,
  type Breaker,
  type CacheHealth,
  type CacheObserver,
} from "./cache-guard.ts";
import { RedisEngineCache, redisFromEnv } from "./redis-cache.ts";
import {
  guardedResultStore,
  redisResultStore,
  type ResultStore,
} from "./result-cache.ts";

interface Backend {
  l1: EngineCache;
  redis: Redis | null;
  breaker: Breaker | null;
}

let backend: Backend | undefined;

function getBackend(): Backend {
  if (backend) return backend;
  const redis = redisFromEnv();
  backend = {
    l1: redis ? createEngineCache() : sharedEngineCache,
    redis,
    breaker: redis ? createBreaker() : null,
  };
  return backend;
}

export interface RequestCaches {
  engine: EngineCache;
  results: ResultStore | null;
  health: (() => CacheHealth) | null;
}

export function requestCaches(observe?: CacheObserver): RequestCaches {
  const { l1, redis, breaker } = getBackend();

  if (!redis || !breaker) {
    return { engine: l1, results: null, health: null };
  }

  return {
    engine: listOnlyTiered(
      l1,
      guardedCache(new RedisEngineCache(redis), breaker, observe),
    ),
    results: guardedResultStore(redisResultStore(redis), breaker, observe),
    health: breaker.health,
  };
}

export function getEngineCache(): EngineCache {
  return requestCaches().engine;
}
