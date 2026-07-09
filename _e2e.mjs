import { traceClaim } from "./src/engine/trace.ts";
import { createEngineCache } from "./src/engine/cache.ts";

const cache = createEngineCache();
const input = {
  article: "Neymar",
  phrase: "youngest player",
  lang: "pt",
  cache,
};

async function timed(label) {
  const t = performance.now();
  try {
    const r = await traceClaim(input);
    console.log(
      `${label}: ${((performance.now() - t) / 1000).toFixed(1)}s  → ${r.verdict.primary}`,
    );
  } catch (e) {
    console.log(
      `${label}: ${((performance.now() - t) / 1000).toFixed(1)}s  (${e.name}: falhou, tento outra frase)`,
    );
    throw e;
  }
}

try {
  await timed("COLD (cache vazio)");
  await timed("WARM (cache cheio)");
} catch {
  input.phrase = "Santos";
  const c2 = createEngineCache();
  input.cache = c2;
  await timed("COLD (cache vazio)");
  await timed("WARM (cache cheio)");
}
