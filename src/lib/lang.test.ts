import { describe, expect, it } from "vitest";
import { safeLang } from "@/lib/lang";

describe("safeLang", () => {
  it("accepts real Wikipedia subdomain codes, lowercasing and trimming", () => {
    expect(safeLang("en")).toBe("en");
    expect(safeLang("PT")).toBe("pt");
    expect(safeLang("  de  ")).toBe("de");
    expect(safeLang("simple")).toBe("simple");
    expect(safeLang("zh-min-nan")).toBe("zh-min-nan");
    expect(safeLang("be-tarask")).toBe("be-tarask");
  });

  it("falls back to English on empty or missing input", () => {
    expect(safeLang(null)).toBe("en");
    expect(safeLang(undefined)).toBe("en");
    expect(safeLang("")).toBe("en");
    expect(safeLang("   ")).toBe("en");
  });

  it("rejects codes that could redirect the outbound fetch host", () => {
    expect(safeLang("en@evil.com/")).toBe("en");
    expect(safeLang("en/../secret")).toBe("en");
    expect(safeLang("evil.com")).toBe("en");
    expect(safeLang("en:8080")).toBe("en");
    expect(safeLang("en wikipedia")).toBe("en");
  });
});
