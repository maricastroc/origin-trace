import { resolveArticles } from "@/engine/resolve.ts";
import { safeLang } from "@/lib/lang";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const phrase = searchParams.get("phrase")?.trim();
  const lang = safeLang(searchParams.get("lang"));

  if (!phrase) {
    return Response.json({ error: "Provide 'phrase'." }, { status: 400 });
  }

  try {
    const resolution = await resolveArticles(phrase, { lang });
    return Response.json(resolution);
  } catch (err) {
    console.error("resolve failed", err);
    return Response.json(
      {
        error:
          "Couldn't reach Wikipedia to resolve that phrase. Please try again.",
      },
      { status: 500 },
    );
  }
}
