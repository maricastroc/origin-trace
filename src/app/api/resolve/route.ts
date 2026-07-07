import { resolveArticles } from "@/engine/resolve.ts";

export const runtime = "nodejs";

/**
 * GET /api/resolve?phrase=...&lang=en
 * Resolves a phrase to candidate articles. Returns a Resolution that is honest
 * about ambiguity — it only pins a scope when the phrase is verbatim in exactly
 * one article.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const phrase = searchParams.get("phrase")?.trim();
  const lang = searchParams.get("lang")?.trim() || "en";

  if (!phrase) {
    return Response.json({ error: "Provide 'phrase'." }, { status: 400 });
  }

  try {
    const resolution = await resolveArticles(phrase, { lang });
    return Response.json(resolution);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
