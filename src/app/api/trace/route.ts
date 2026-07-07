import { ClaimNotFoundError, traceClaim } from "@/engine/trace.ts";

/** The engine uses Node's fetch and reads live wikitext — Node.js runtime. */
export const runtime = "nodejs";
/** A full trace does dozens of sequential reads; give it room (Vercel hint). */
export const maxDuration = 120;

/**
 * GET /api/trace?article=Quokka&phrase=happiest%20animal&lang=en
 * Runs the WikiBlame pipeline live and returns a ClaimProvenance — the same
 * contract the UI reads from the mocks.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const article = searchParams.get("article")?.trim();
  const phrase = searchParams.get("phrase")?.trim();
  const lang = searchParams.get("lang")?.trim() || "en";

  if (!article || !phrase) {
    return Response.json(
      { error: "Informe 'article' e 'phrase'." },
      { status: 400 },
    );
  }

  try {
    const provenance = await traceClaim({ article, phrase, lang });
    return Response.json(provenance);
  } catch (err) {
    if (err instanceof ClaimNotFoundError) {
      return Response.json(
        {
          error: `A frase não foi encontrada no histórico de "${article}". Tente um trecho mais curto e literal.`,
        },
        { status: 404 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
