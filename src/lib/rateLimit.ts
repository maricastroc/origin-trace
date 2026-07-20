/**
 * A dependency-free token-bucket rate limiter for the unauthenticated API routes
 * that fan out to the public Wikipedia API. Each caller (keyed by IP) gets a
 * bucket of `limit` tokens that refills smoothly over `windowMs`; a request
 * costs one token, and an empty bucket is refused with the time until the next
 * token — so a single client can't spin up the box or hammer Wikipedia through
 * it (a DoS-amplification vector on an endpoint this expensive).
 *
 * State lives in-process, so on a serverless / multi-instance deployment the
 * budget is enforced *per instance* — a deliberate, documented trade-off: it
 * removes the amplification vector with zero infrastructure. For a single global
 * budget across instances, back this same `take()` contract with the optional
 * Redis client (see {@link file://./../engine/redis-cache.ts}) — the routes
 * wouldn't change.
 *
 * Time is injectable (`take(key, now)`), exactly like the engine's `fetchJson`
 * seam, so the buckets are tested offline with a synthetic clock — no timers,
 * no sleeps. See rateLimit.test.ts.
 */

export interface RateLimitRule {
  /** Bucket capacity — the largest burst allowed from a cold start. */
  limit: number;
  /** Milliseconds to refill the bucket from empty back to full. */
  windowMs: number;
}

export interface RateLimitDecision {
  ok: boolean;
  limit: number;
  /** Whole tokens left after this request. */
  remaining: number;
  /** Milliseconds until the next token would be available — 0 when allowed. */
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Once the table grows past this, a `take()` sweeps out fully-refilled buckets
 *  (idle callers) so a burst of unique IPs can't grow the Map without bound. */
const SWEEP_THRESHOLD = 5000;

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly rule: RateLimitRule) {}

  take(key: string, now: number): RateLimitDecision {
    const { limit, windowMs } = this.rule;
    const ratePerMs = limit / windowMs;

    const prior = this.buckets.get(key);
    const tokens =
      prior === undefined
        ? limit
        : Math.min(limit, prior.tokens + Math.max(0, now - prior.updatedAt) * ratePerMs);

    if (tokens >= 1) {
      const left = tokens - 1;
      this.buckets.set(key, { tokens: left, updatedAt: now });
      if (this.buckets.size > SWEEP_THRESHOLD) this.sweep(now);
      return {
        ok: true,
        limit,
        remaining: Math.floor(left),
        retryAfterMs: 0,
      };
    }

    this.buckets.set(key, { tokens, updatedAt: now });
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfterMs: Math.ceil((1 - tokens) / ratePerMs),
    };
  }

  /** Forget buckets that have fully refilled — they hold no state a fresh
   *  caller wouldn't reproduce, so dropping them is free. */
  private sweep(now: number): void {
    const { limit, windowMs } = this.rule;
    const ratePerMs = limit / windowMs;
    for (const [key, b] of this.buckets) {
      const tokens = Math.min(limit, b.tokens + (now - b.updatedAt) * ratePerMs);
      if (tokens >= limit) this.buckets.delete(key);
    }
  }
}

/** Per-instance registry so each named route keeps one bucket table across
 *  requests without a module-level singleton per route file. */
const limiters = new Map<string, RateLimiter>();

export function getLimiter(name: string, rule: RateLimitRule): RateLimiter {
  let limiter = limiters.get(name);
  if (limiter === undefined) {
    limiter = new RateLimiter(rule);
    limiters.set(name, limiter);
  }
  return limiter;
}

/** Best-effort client identity from the usual proxy headers. Falls back to a
 *  single shared key when none are present (local dev), which simply means the
 *  limit applies globally there — still safe, never throws. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "local"
  );
}

/**
 * The one call a route makes: returns a ready-to-send `429` Response when the
 * caller is over budget, or `null` to proceed. Keeping the Response here means
 * every route rejects identically (status, `Retry-After`, rate-limit headers).
 */
export function enforceRateLimit(
  request: Request,
  name: string,
  rule: RateLimitRule,
): Response | null {
  const decision = getLimiter(name, rule).take(clientKey(request), Date.now());
  if (decision.ok) return null;

  const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  return Response.json(
    {
      error: `Too many requests — this endpoint is deliberately rate-limited. Retry in ${retryAfterSec}s.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/** The budgets, in one place so they're auditable. The Wikipedia-facing cost of
 *  each route sets its generosity: a whole-history trace/audit is far heavier
 *  than a single resolve or prewarm fetch. Per IP, per instance, per minute. */
export const RATE_LIMITS = {
  trace: { limit: 15, windowMs: 60_000 },
  audit: { limit: 10, windowMs: 60_000 },
  resolve: { limit: 30, windowMs: 60_000 },
  prewarm: { limit: 40, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;
