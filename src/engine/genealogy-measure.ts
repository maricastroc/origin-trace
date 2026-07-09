// Genealogy measurement harness.
//
// Runs the diff-genealogy walk over two corpora and reports the terminus
// distribution — the number that decides whether a semantic (LLM) layer is
// worth building at all. The *residual shape* aggregation is the payload: it
// splits what genealogy can't resolve into "wants more determinism" vs.
// "genuinely semantic" vs. "unrecoverable", so the decision is a measurement,
// not a guess.
//
//   Curated corpus — the investigation registry (biased toward interesting
//     cases; good for sanity, useless for a base rate).
//   Representative corpus — anchored sentences sampled from diverse articles;
//     THIS is where the honest residual number comes from.
//
// Output is data-first: histogram, terminus distribution, a few representative
// examples per category, and a conclusion — not a play-by-play of each claim.
//
// Usage:
//   npm run engine:genealogy -- [--only curated|representative]
//                               [--articles A,B,C] [--sample N] [--lang en]

import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { sampleBodyClaims } from "./sample.ts";
import type { EngineCache } from "./cache.ts";
import { WikipediaClient, type RevisionList } from "./wikipedia.ts";
import {
  reconstructGenealogy,
  residualShape,
  type Genealogy,
  type Terminus,
} from "./genealogy.ts";
import { REGISTRY } from "../investigations/registry.ts";

interface Claim {
  label: string;
  article: string;
  phrase: string;
  lang?: string;
}

interface Result {
  claim: Claim;
  g: Genealogy | null;
  error: string | null;
}

type Shape = "resolved" | "more-determinism" | "semantic" | "unrecoverable";

// A plain-Map cache local to the harness. (The shared LruEngineCache in cache.ts
// uses TS parameter properties, which `node --experimental-strip-types` can't
// load; keeping our own avoids importing it at runtime.) Reuse across claims
// matters: representative claims from the same article share its revision list.
class MeasureCache implements EngineCache {
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

const DEFAULT_ARTICLES = [
  "Photosynthesis",
  "Penicillin",
  "Mount Everest",
  "Great Wall of China",
  "Aspirin",
  "Insulin",
  "Marie Curie",
  "Jupiter",
  "Pluto",
  "Bicycle",
];

const TERMINI: Terminus[] = [
  "origin:fresh-insertion",
  "origin:first-revision",
  "origin:bulk-insertion",
  "broke:structured-genesis",
  "broke:cross-article-merge",
  "broke:no-anchor-reword",
  "broke:low-overlap",
  "broke:anchors-elsewhere",
  "broke:no-anchors",
];

const SHAPES: Shape[] = ["resolved", "more-determinism", "semantic", "unrecoverable"];

function curatedCorpus(): Claim[] {
  return REGISTRY.filter((s) => s.seed.kind === "trace").map((s) => {
    const seed = s.seed as { kind: "trace"; article: string; phrase: string; lang?: string };
    return { label: s.slug, article: seed.article, phrase: seed.phrase, lang: seed.lang };
  });
}

async function representativeCorpus(
  articles: string[],
  perArticle: number,
  lang: string,
  cache: EngineCache,
): Promise<Claim[]> {
  const client = new WikipediaClient({ lang, cache });
  const claims: Claim[] = [];
  for (const article of articles) {
    try {
      const current = await client.getCurrentContent(article);
      if (!current) {
        process.stdout.write(`  ! ${article}: no current content (skipped)\n`);
        continue;
      }
      const { picks, candidates } = sampleBodyClaims(current.content, perArticle);
      picks.forEach((raw, k) => claims.push({ label: `${article}#${k}`, article, phrase: raw, lang }));
      process.stdout.write(`  · ${article}: ${picks.length} claims (of ${candidates} body candidates)\n`);
    } catch (err) {
      process.stdout.write(`  ! ${article}: ${msg(err)} (skipped)\n`);
    }
  }
  return claims;
}

async function measure(
  corpus: Claim[],
  cache: EngineCache,
  corpusName: string,
  checkpointPath: string,
): Promise<Result[]> {
  const results: Result[] = [];
  const running = new Map<Terminus, number>();
  let i = 0;
  for (const claim of corpus) {
    i++;
    let rec: Record<string, unknown>;
    try {
      const g = await reconstructGenealogy({
        article: claim.article,
        phrase: claim.phrase,
        lang: claim.lang,
        cache,
      });
      results.push({ claim, g, error: null });
      running.set(g.terminus, (running.get(g.terminus) ?? 0) + 1);
      rec = {
        corpus: corpusName,
        label: claim.label,
        terminus: g.terminus,
        shape: residualShape(g.terminus),
        moved: g.movedEarlier,
        verdictShift: g.verdictShift,
        hops: g.chain.length,
        fetches: g.contentFetches,
      };
    } catch (err) {
      results.push({ claim, g: null, error: msg(err) });
      rec = { corpus: corpusName, label: claim.label, phrase: claim.phrase, error: msg(err) };
    }
    // Checkpoint every claim (synchronous append) so a partial histogram is
    // always recoverable from the file mid-run, even if this is killed.
    appendFileSync(checkpointPath, `${JSON.stringify(rec)}\n`);
    if (i % 5 === 0 || i === corpus.length) {
      const snapshot = [...running.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t, c]) => `${t.split(":")[1]} ${c}`)
        .join(" · ");
      process.stdout.write(`  [${corpusName} ${i}/${corpus.length}] ${snapshot}\n`);
    }
  }
  return results;
}

function report(name: string, results: Result[]): Record<string, unknown> {
  const located = results.filter((r): r is Result & { g: Genealogy } => r.g !== null);
  const unlocatable = results.length - located.length;

  const byTerminus = new Map<Terminus, number>();
  const byShape = new Map<Shape, number>();
  let movedEarlier = 0;
  let verdictShifts = 0;
  let hops = 0;
  let fetches = 0;
  for (const { g } of located) {
    byTerminus.set(g.terminus, (byTerminus.get(g.terminus) ?? 0) + 1);
    const shape = residualShape(g.terminus);
    byShape.set(shape, (byShape.get(shape) ?? 0) + 1);
    if (g.movedEarlier) movedEarlier++;
    if (g.verdictShift) verdictShifts++;
    hops += g.chain.length;
    fetches += g.contentFetches;
  }

  const n = located.length;
  const pct = (k: number) => (n ? `${Math.round((k / n) * 100)}%`.padStart(4) : "  —");

  process.stdout.write(
    `\n══ ${name.toUpperCase()} — ${n} located, ${unlocatable} unlocatable ══\n`,
  );

  process.stdout.write(`\n  terminus distribution\n`);
  for (const t of TERMINI) {
    const c = byTerminus.get(t) ?? 0;
    if (c) {
      process.stdout.write(
        `    ${t.padEnd(26)} ${String(c).padStart(3)} ${pct(c)}   [${residualShape(t)}]\n`,
      );
    }
  }

  process.stdout.write(`\n  residual shape\n`);
  for (const s of SHAPES) {
    const c = byShape.get(s) ?? 0;
    if (c) process.stdout.write(`    ${s.padEnd(26)} ${String(c).padStart(3)} ${pct(c)}\n`);
  }

  process.stdout.write(`\n  representative examples (≤3 per terminus)\n`);
  for (const t of TERMINI) {
    const hits = located.filter((r) => r.g.terminus === t).slice(0, 3);
    if (hits.length === 0) continue;
    process.stdout.write(`    ${t}\n`);
    for (const { g } of hits) {
      const arrow = g.movedEarlier ? `${g.lexicalOrigin.date}→${g.origin.date}` : `${g.origin.date}`;
      const shift = g.verdictShift ? `  ⚑ ${g.verdictShift.from}→${g.verdictShift.to}` : "";
      const shown = g.chain[0]?.wording ?? g.phrase; // the located, cleaned sentence
      process.stdout.write(`      • ${g.article} — "${truncate(shown, 56)}"  (${arrow}, ${g.chain.length}h)${shift}\n`);
    }
  }

  const missed = results.filter((r) => r.g === null);
  if (missed.length) {
    process.stdout.write(`\n  unlocatable (${missed.length}) — phrase never matched a revision\n`);
    for (const r of missed.slice(0, 8)) {
      process.stdout.write(`    · ${r.claim.article} — "${truncate(r.claim.phrase, 56)}"\n`);
    }
  }

  const shapePct = (s: Shape) => (n ? Math.round(((byShape.get(s) ?? 0) / n) * 100) : 0);
  process.stdout.write(
    `\n  conclusion\n` +
      `    resolved ${shapePct("resolved")}% · more-determinism ${shapePct("more-determinism")}%` +
      ` · semantic ${shapePct("semantic")}% (upper bound) · unrecoverable ${shapePct("unrecoverable")}%\n` +
      `    moved earlier ${movedEarlier}/${n} · verdict shifts ${verdictShifts}` +
      ` · avg hops ${n ? (hops / n).toFixed(1) : "—"} · avg fetches ${n ? (fetches / n).toFixed(0) : "—"}\n`,
  );

  return {
    corpus: name,
    located: n,
    unlocatable,
    terminusHistogram: Object.fromEntries(byTerminus),
    residualShape: Object.fromEntries(byShape),
    movedEarlier,
    verdictShifts,
    avgHops: n ? hops / n : null,
    avgFetches: n ? fetches / n : null,
  };
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  let only: "curated" | "representative" | null = null;
  let lang = "en";
  let sample = 4;
  let articles = DEFAULT_ARTICLES;
  let out = `${tmpdir()}/origin-trace-genealogy.jsonl`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only") only = args[++i] === "representative" ? "representative" : "curated";
    else if (args[i] === "--lang") lang = args[++i] ?? "en";
    else if (args[i] === "--sample") sample = Number(args[++i]) || 4;
    else if (args[i] === "--articles") articles = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (args[i] === "--out") out = args[++i] ?? out;
  }

  writeFileSync(out, ""); // truncate: one JSONL line per claim, readable mid-run for a partial histogram
  process.stdout.write(`checkpoint: ${out}\n`);

  const cache = new MeasureCache();
  const dump: Record<string, unknown>[] = [];

  if (only !== "representative") {
    dump.push(report("curated", await measure(curatedCorpus(), cache, "curated", out)));
  }
  if (only !== "curated") {
    process.stdout.write("\nsampling representative corpus…\n");
    const corpus = await representativeCorpus(articles, sample, lang, cache);
    dump.push(report("representative", await measure(corpus, cache, "representative", out)));
  }

  process.stdout.write(`\n${JSON.stringify(dump)}\n`);
  return 0;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main(process.argv).then((code) => {
  process.exitCode = code;
});
