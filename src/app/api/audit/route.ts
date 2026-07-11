import { ArticleNotFoundError, auditArticle } from "@/engine/audit.ts";
import { getEngineCache } from "@/engine/persistent-cache.ts";
import { safeLang } from "@/lib/lang";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const lang = safeLang(searchParams.get("lang"));

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
    console.error("audit failed", err);
    return Response.json(
      {
        error:
          "Couldn't finish the audit — Wikipedia may be unreachable. Please try again.",
      },
      { status: 500 },
    );
  }
}
