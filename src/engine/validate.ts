/**
 * Turns the manual traces into an automatic regression check against the live
 * Wikipedia API.
 *
 *   node --experimental-strip-types src/engine/validate.ts
 *
 * The engine is allowed — encouraged — to find an *earlier* origin than a hand
 * trace did (that is the whole point: deterministic blame beats a human summary
 * at finding where a claim really started). So the invariant is not equality but
 * an inequality that would only break if the engine *missed* the origin:
 *
 *   engine.originTimestamp  ≤  manuallyPinnedOriginTimestamp
 *
 * Anything the engine finds at or before the human's pin is a pass; a later
 * origin is a real failure. We also pin the engine's currently-found revid as a
 * regression anchor (informational — the live article's current state drifts).
 */
import { traceClaim } from "./trace.ts";
import { WikipediaClient } from "./wikipedia.ts";

interface Fixture {
  name: string;
  article: string;
  phrase: string;
  /** The origin revision the manual trace pinned (from src/mocks/*). */
  manualOriginRevId: number;
  /** The origin revid the engine currently finds — a regression anchor. */
  expectedEngineOriginRevId: number;
}

const FIXTURES: Fixture[] = [
  {
    name: "quokka",
    article: "Quokka",
    phrase: "happiest animal",
    manualOriginRevId: 729272914, // 2016-07, HuffPost cite
    expectedEngineOriginRevId: 609716334, // 2014-05, unsourced — earlier
  },
  {
    name: "coati",
    article: "Coati",
    phrase: "Brazilian aardvark",
    manualOriginRevId: 229827595, // 2008-08
    expectedEngineOriginRevId: 225140818, // 2008-07 — earlier
  },
  {
    name: "petasites",
    article: "Petasites",
    phrase: "pyrrolizidine alkaloids",
    manualOriginRevId: 322775877, // 2009
    expectedEngineOriginRevId: 110608704, // 2007-02 — earlier
  },
];

async function timestampOf(article: string, revId: number): Promise<string> {
  const { revisions } = await new WikipediaClient().listRevisions(article);
  return revisions.find((r) => r.revid === revId)?.timestamp ?? "";
}

async function run(): Promise<number> {
  let failures = 0;

  for (const f of FIXTURES) {
    process.stdout.write(`\n▸ ${f.name} — "${f.phrase}" in ${f.article}\n`);
    const provenance = await traceClaim({ article: f.article, phrase: f.phrase });
    const origin = provenance.timeline.find((e) => e.kind === "claim-introduced");
    const originRevId = origin?.revId;

    if (!originRevId) {
      process.stdout.write("  ✗ no introduction found\n");
      failures++;
      continue;
    }

    const [engineTs, manualTs] = await Promise.all([
      timestampOf(f.article, originRevId),
      timestampOf(f.article, f.manualOriginRevId),
    ]);

    const notLater = engineTs !== "" && manualTs !== "" && engineTs <= manualTs;
    const mark = notLater ? "✓" : "✗";
    process.stdout.write(
      `  ${mark} engine origin rev ${originRevId} (${engineTs.slice(0, 10)}) ` +
        `≤ manual pin ${f.manualOriginRevId} (${manualTs.slice(0, 10)})\n`,
    );
    process.stdout.write(
      `    verdict: ${provenance.verdict.primary} — ${origin?.source ? "born-sourced" : "born-unsourced"}\n`,
    );
    if (originRevId !== f.expectedEngineOriginRevId) {
      process.stdout.write(
        `    · note: engine origin drifted from anchor ${f.expectedEngineOriginRevId} (informational)\n`,
      );
    }
    if (!notLater) failures++;
  }

  process.stdout.write(
    `\n${failures === 0 ? "PASS" : "FAIL"} — ${FIXTURES.length - failures}/${FIXTURES.length} fixtures\n`,
  );
  return failures === 0 ? 0 : 1;
}

run().then((code) => {
  process.exitCode = code;
});
