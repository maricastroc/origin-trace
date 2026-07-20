import { describe, expect, it } from "vitest";
import { GET as traceGET } from "@/app/api/trace/route.ts";
import { GET as resolveGET } from "@/app/api/resolve/route.ts";
import { GET as auditGET } from "@/app/api/audit/route.ts";
import { RATE_LIMITS } from "@/lib/rateLimit";

const req = (path: string) => new Request(`http://localhost${path}`);

describe("GET /api/trace", () => {
  it("rejects a request missing article or phrase with 400", async () => {
    const res = await traceGET(req("/api/trace?article=Quokka"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/article.*phrase/i);
  });
});

describe("GET /api/resolve", () => {
  it("rejects a request missing the phrase with 400", async () => {
    const res = await resolveGET(req("/api/resolve"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/phrase/i);
  });
});

describe("GET /api/audit", () => {
  it("rejects a request missing the article with 400", async () => {
    const res = await auditGET(req("/api/audit"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/article/i);
  });
});

describe("rate limiting", () => {
  const fromIp = (ip: string) =>
    new Request("http://localhost/api/resolve", {
      headers: { "x-forwarded-for": ip },
    });

  it("refuses a caller over budget with 429 + Retry-After", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < RATE_LIMITS.resolve.limit; i++) {
      const res = await resolveGET(fromIp(ip));
      expect(res.status).toBe(400);
    }
    const throttled = await resolveGET(fromIp(ip));
    expect(throttled.status).toBe(429);
    expect(Number(throttled.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
