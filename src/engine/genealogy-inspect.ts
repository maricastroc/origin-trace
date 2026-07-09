// Genealogy inspection — the correctness gate.
//
// Reproduces the exact benchmark sample (via the shared sampleBodyClaims) and
// dumps the FULL chain for the claims of interest: every hop's wording, revision,
// sourced state, and the anchors that linked it to the next — plus Wikipedia
// diff URLs so each link and each sourced/unsourced call can be checked against
// the real revision. Used to hand-audit that we never assert a false provenance
// before wiring genealogy into the product.
//
// Usage:
//   npm run engine:inspect -- --articles "Marie Curie,Penicillin" [--shifts] [--deep 4] [--sample 4]

import type { EngineCache } from "./cache.ts";
import { reconstructGenealogy, type Genealogy } from "./genealogy.ts";
import { sampleBodyClaims } from "./sample.ts";
import { WikipediaClient, type RevisionList } from "./wikipedia.ts";

class InspectCache implements EngineCache {
  content = new Map<string, string | null>();
  list = new Map<string, RevisionList>();
  async getContent(lang: string, revid: number) {
    return this.content.get(`${lang}:${revid}`);
  }
  async setContent(lang: string, revid: number, value: string | null) {
    this.content.set(`${lang}:${revid}`, value);
  }
  async getList(lang: string, title: string) {
    return this.list.get(`${lang}:${title}`);
  }
  async setList(lang: string, title: string, value: RevisionList) {
    this.list.set(`${lang}:${title}`, value);
  }
}

function oldidUrl(lang: string, revid: number): string {
  return `https://${lang}.wikipedia.org/w/index.php?oldid=${revid}`;
}

function diffUrl(lang: string, revid: number): string {
  return `https://${lang}.wikipedia.org/w/index.php?diff=prev&oldid=${revid}`;
}

function printChain(label: string, lang: string, g: Genealogy): void {
  const shift = g.verdictShift ? `   ⚑ ${g.verdictShift.from} → ${g.verdictShift.to}` : "";
  process.stdout.write(
    `\n━━ ${label} ━━  ${g.terminus}${shift}  (${g.chain.length} hops, ${g.contentFetches} fetches)` +
      `${g.nonMonotonic ? "  ~nonmonotonic" : ""}\n`,
  );
  process.stdout.write(
    `  lexical origin  ${g.lexicalOrigin.date}  rev ${g.lexicalOrigin.revId}  [${g.lexicalOrigin.sourced ? "sourced" : "unsourced"}]\n` +
      `  genealogy origin ${g.origin.date}  rev ${g.origin.revId}  [${g.origin.sourced ? "sourced" : "unsourced"}]\n`,
  );
  process.stdout.write(`  chain (newest → oldest):\n`);
  g.chain.forEach((hop, i) => {
    const src = hop.sourced ? `SRC:${hop.sourceLabel ?? "?"}` : "unsourced";
    const dice = hop.overlap !== undefined ? `  dice=${hop.overlap.toFixed(2)}` : "";
    const link = hop.anchorsShared.length ? `  →shared[${hop.anchorsShared.join(", ")}]` : "";
    const tag = i === g.chain.length - 1 ? "  (ORIGIN)" : "";
    process.stdout.write(
      `    #${i}  ${hop.date}  rev ${hop.revId}  ${src}${dice}${link}${tag}\n` +
        `        "${hop.wording}"\n`,
    );
  });
  if (g.stopOverlap !== null) {
    process.stdout.write(`  ⨯ abstained: next link dice=${g.stopOverlap.toFixed(2)} below threshold\n`);
  }
  process.stdout.write(
    `  verify:\n` +
      `    origin diff:  ${diffUrl(lang, g.origin.revId)}\n` +
      `    origin rev:   ${oldidUrl(lang, g.origin.revId)}\n` +
      `    lexical diff: ${diffUrl(lang, g.lexicalOrigin.revId)}\n`,
  );
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  let articles: string[] = [];
  let lang = "en";
  let sample = 4;
  let onlyShifts = false;
  let deepMin = 0;
  let overlapMin: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--articles") articles = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (args[i] === "--lang") lang = args[++i] ?? "en";
    else if (args[i] === "--sample") sample = Number(args[++i]) || 4;
    else if (args[i] === "--shifts") onlyShifts = true;
    else if (args[i] === "--deep") deepMin = Number(args[++i]) || 0;
    else if (args[i] === "--overlap") overlapMin = Number(args[++i]);
  }
  if (articles.length === 0) {
    process.stderr.write('Usage: genealogy-inspect.ts --articles "A,B" [--shifts] [--deep N] [--sample N]\n');
    return 2;
  }

  const keep = (g: Genealogy) =>
    (!onlyShifts || g.verdictShift !== null) && g.chain.length >= deepMin;

  const cache = new InspectCache();
  const client = new WikipediaClient({ lang, cache });

  for (const article of articles) {
    const current = await client.getCurrentContent(article);
    if (!current) {
      process.stdout.write(`\n! ${article}: no current content\n`);
      continue;
    }
    const { picks } = sampleBodyClaims(current.content, sample);
    for (let k = 0; k < picks.length; k++) {
      try {
        const g = await reconstructGenealogy({ article, phrase: picks[k], lang, cache, overlapMin });
        if (keep(g)) printChain(`${article}#${k}`, lang, g);
      } catch (err) {
        process.stdout.write(`\n━━ ${article}#${k} ━━  unlocatable: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }
  }
  return 0;
}

main(process.argv).then((code) => {
  process.exitCode = code;
});
