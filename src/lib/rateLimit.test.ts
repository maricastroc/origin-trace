import { describe, expect, it } from "vitest";
import { RateLimiter, clientKey } from "@/lib/rateLimit";

describe("RateLimiter", () => {
  it("allows a cold caller a full burst, then refuses", () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 60_000 });
    const now = 1_000;
    expect(rl.take("ip", now).ok).toBe(true);
    expect(rl.take("ip", now).ok).toBe(true);
    const third = rl.take("ip", now);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    expect(rl.take("ip", now).ok).toBe(false);
  });

  it("reports the wait until the next token when empty", () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 60_000 });
    rl.take("ip", 0);
    rl.take("ip", 0);
    const denied = rl.take("ip", 0);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterMs).toBe(30_000);
  });

  it("refills smoothly as time passes", () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 60_000 });
    rl.take("ip", 0);
    rl.take("ip", 0);
    expect(rl.take("ip", 0).ok).toBe(false);
    expect(rl.take("ip", 30_000).ok).toBe(true);
    expect(rl.take("ip", 30_000).ok).toBe(false);
    expect(rl.take("ip", 90_000).ok).toBe(true);
  });

  it("never over-fills beyond capacity after a long idle", () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 60_000 });
    rl.take("ip", 0);

    expect(rl.take("ip", 3_600_000).ok).toBe(true);
    expect(rl.take("ip", 3_600_000).ok).toBe(true);
    expect(rl.take("ip", 3_600_000).ok).toBe(true);
    expect(rl.take("ip", 3_600_000).ok).toBe(false);
  });

  it("keys callers independently", () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(rl.take("a", 0).ok).toBe(true);
    expect(rl.take("a", 0).ok).toBe(false);
    expect(rl.take("b", 0).ok).toBe(true);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://example.test/api/trace", { headers });

  it("takes the first hop of x-forwarded-for", () => {
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });

  it("falls back through the proxy headers, then to a shared local key", () => {
    expect(clientKey(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(req({ "cf-connecting-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientKey(req({}))).toBe("local");
  });
});
