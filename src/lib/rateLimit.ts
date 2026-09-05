export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

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
        : Math.min(
            limit,
            prior.tokens + Math.max(0, now - prior.updatedAt) * ratePerMs,
          );

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

  private sweep(now: number): void {
    const { limit, windowMs } = this.rule;
    const ratePerMs = limit / windowMs;
    for (const [key, b] of this.buckets) {
      const tokens = Math.min(
        limit,
        b.tokens + (now - b.updatedAt) * ratePerMs,
      );
      if (tokens >= limit) this.buckets.delete(key);
    }
  }
}

const limiters = new Map<string, RateLimiter>();

export function getLimiter(name: string, rule: RateLimitRule): RateLimiter {
  let limiter = limiters.get(name);
  if (limiter === undefined) {
    limiter = new RateLimiter(rule);
    limiters.set(name, limiter);
  }
  return limiter;
}

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

export const RATE_LIMITS = {
  trace: { limit: 15, windowMs: 60_000 },
  audit: { limit: 10, windowMs: 60_000 },
  resolve: { limit: 30, windowMs: 60_000 },
  prewarm: { limit: 40, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;
