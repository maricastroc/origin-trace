import { ArticleNotFoundError, auditArticle } from "@/engine/audit.ts";
import { getEngineCache } from "@/engine/persistent-cache.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const lang = searchParams.get("lang")?.trim() || "en";

  if (!article) {
    return Response.json({ error: "Provide 'article'." }, { status: 400 });
  }

  try {
    const audit = await auditArticle({
      article,
      lang,
      cache: getEngineCache(),
    });
    return Response.json(audit);
  } catch (err) {
    if (err instanceof ArticleNotFoundError) {
      return Response.json(
        {
          error: `Couldn't read “${article}” on ${lang}.wikipedia. Check the exact title.`,
        },
        { status: 404 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
