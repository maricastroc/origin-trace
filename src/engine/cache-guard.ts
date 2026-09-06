import type { EngineCache } from "./cache.ts";
import type { RevisionList } from "./wikipedia.ts";

export type CacheOutcome =
  "hit" | "miss" | "ok" | "timeout" | "error" | "bypass";

export type CacheChannel = "content" | "list" | "result";

export type CacheOp = "read" | "write";

export type BreakerState = "closed" | "open" | "half-open";

export interface CacheHealth {
  state: BreakerState;
  consecutiveFailures: number;
  trips: number;
  outcomes: Record<CacheOutcome, number>;
  waitedMs: number;
}

export interface GuardOptions {
  timeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
  onOutcome?: (
    channel: CacheChannel,
    op: CacheOp,
    outcome: CacheOutcome,
    ms: number,
  ) => void;
}

export interface GuardedCache extends EngineCache {
  health(): CacheHealth;
}

export type CacheObserver = (
  channel: CacheChannel,
  op: CacheOp,
  outcome: CacheOutcome,
  ms: number,
) => void;

export interface Breaker {
  run<T>(
    channel: CacheChannel,
    op: CacheOp,
    fn: () => Promise<T>,
    fallback: T,
    classify: (value: T) => CacheOutcome,
    observe?: CacheObserver,
  ): Promise<T>;
  health(): CacheHealth;
}

export const DEFAULT_TIMEOUT_MS = 500;
export const DEFAULT_FAILURE_THRESHOLD = 2;
export const DEFAULT_COOLDOWN_MS = 30_000;

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`cache operation exceeded ${ms}ms`);
    this.name = "CacheTimeoutError";
  }
}

export function createBreaker(opts: GuardOptions = {}): Breaker {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const threshold = opts.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const cooldownMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = opts.now ?? (() => Date.now());
  const report = opts.onOutcome;

  let state: BreakerState = "closed";
  let consecutiveFailures = 0;
  let trips = 0;
  let openedAt = 0;
  let trialInFlight = false;
  let waitedMs = 0;
  const outcomes: Record<CacheOutcome, number> = {
    hit: 0,
    miss: 0,
    ok: 0,
    timeout: 0,
    error: 0,
    bypass: 0,
  };

  const record = (
    channel: CacheChannel,
    op: CacheOp,
    outcome: CacheOutcome,
    ms: number,
    observe?: CacheObserver,
  ): void => {
    outcomes[outcome]++;
    waitedMs += ms;
    report?.(channel, op, outcome, ms);
    observe?.(channel, op, outcome, ms);
  };

  const admit = (): boolean => {
    if (state === "closed") return true;
    if (now() - openedAt < cooldownMs) return false;
    if (trialInFlight) return false;
    state = "half-open";
    trialInFlight = true;
    return true;
  };

  const succeed = (): void => {
    consecutiveFailures = 0;
    state = "closed";
    trialInFlight = false;
  };

  const fail = (): void => {
    consecutiveFailures++;
    trialInFlight = false;
    if (state === "half-open" || consecutiveFailures >= threshold) {
      if (state !== "open") trips++;
      state = "open";
      openedAt = now();
    }
  };

  async function guard<T>(
    channel: CacheChannel,
    op: CacheOp,
    run: () => Promise<T>,
    fallback: T,
    classify: (value: T) => CacheOutcome,
    observe?: CacheObserver,
  ): Promise<T> {
    if (!admit()) {
      record(channel, op, "bypass", 0, observe);
      return fallback;
    }

    const started = now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        run(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new TimeoutError(timeoutMs)),
            timeoutMs,
          );
        }),
      ]);
      succeed();
      record(channel, op, classify(value), now() - started, observe);
      return value;
    } catch (err) {
      fail();
      record(
        channel,
        op,
        err instanceof TimeoutError ? "timeout" : "error",
        now() - started,
        observe,
      );
      return fallback;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  const detach = <T>(p: Promise<T>): Promise<T> => {
    p.catch(() => {});
    return p;
  };

  return {
    run(channel, op, fn, fallback, classify, observe) {
      return guard(
        channel,
        op,
        () => detach(fn()),
        fallback,
        classify,
        observe,
      );
    },
    health() {
      return {
        state,
        consecutiveFailures,
        trips,
        outcomes: { ...outcomes },
        waitedMs,
      };
    },
  };
}

export const readOutcome = (v: unknown): CacheOutcome =>
  v === undefined ? "miss" : "hit";

const writeOutcome = (): CacheOutcome => "ok";

export function guardedCache(
  inner: EngineCache,
  optsOrBreaker: GuardOptions | Breaker = {},
  observe?: CacheObserver,
): GuardedCache {
  const breaker =
    "run" in optsOrBreaker ? optsOrBreaker : createBreaker(optsOrBreaker);

  return {
    getContent(lang, revid) {
      return breaker.run(
        "content",
        "read",
        () => inner.getContent(lang, revid),
        undefined,
        readOutcome,
        observe,
      );
    },
    setContent(lang, revid, value) {
      return breaker.run(
        "content",
        "write",
        () => inner.setContent(lang, revid, value),
        undefined,
        writeOutcome,
        observe,
      );
    },
    getList(lang, title) {
      return breaker.run<RevisionList | undefined>(
        "list",
        "read",
        () => inner.getList(lang, title),
        undefined,
        readOutcome,
        observe,
      );
    },
    setList(lang, title, value) {
      return breaker.run(
        "list",
        "write",
        () => inner.setList(lang, title, value),
        undefined,
        writeOutcome,
        observe,
      );
    },
    health: breaker.health,
  };
}
