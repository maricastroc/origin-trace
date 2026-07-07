import { ArticleNotFoundError, auditArticle } from "@/engine/audit.ts";
import { sharedEngineCache } from "@/engine/cache.ts";

/** Reads live wikitext with Node's fetch — Node.js runtime. */
export const runtime = "nodejs";
/** One big article fetch + parse; generous but bounded. */
export const maxDuration = 60;

/**
 * GET /api/audit?article=Quokka&lang=en
 *
 * The cheap tier: a single-fetch, deterministic "sourced map" of the article's
 * current revision — which sentences carry an inline citation and which assert
 * without one. Per-claim history (retrofit/churn) is the expensive tier, run on
 * demand via /api/trace against a flagged sentence.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const lang = searchParams.get("lang")?.trim() || "en";

  if (!article) {
    return Response.json({ error: "Provide 'article'." }, { status: 400 });
  }

  try {
    const audit = await auditArticle({ article, lang, cache: sharedEngineCache });
    return Response.json(audit);
  } catch (err) {
    if (err instanceof ArticleNotFoundError) {
      return Response.json(
        { error: `Couldn't read “${article}” on ${lang}.wikipedia. Check the exact title.` },
        { status: 404 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
