import { describe, expect, it } from "vitest";
import { GET as traceGET } from "@/app/api/trace/route.ts";
import { GET as resolveGET } from "@/app/api/resolve/route.ts";
import { GET as auditGET } from "@/app/api/audit/route.ts";

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
