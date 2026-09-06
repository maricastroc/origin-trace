import { WikipediaClient } from "@/engine/wikipedia.ts";
import { getEngineCache } from "@/engine/persistent-cache.ts";
import { safeLang } from "@/lib/lang";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request, "prewarm", RATE_LIMITS.prewarm);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const lang = safeLang(searchParams.get("lang"));

  if (!article) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const client = new WikipediaClient({ lang, cache: getEngineCache() });
  try {
    await client.listRevisions(article);
    await client.getCurrentContent(article).catch(() => null);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false });
  }
}
