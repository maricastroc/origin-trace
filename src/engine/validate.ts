import { traceClaim } from "./trace.ts";
import { WikipediaClient } from "./wikipedia.ts";

interface Fixture {
  name: string;
  article: string;
  phrase: string;
  manualOriginRevId: number;
  expectedEngineOriginRevId: number;
}

const FIXTURES: Fixture[] = [
  {
    name: "quokka",
    article: "Quokka",
    phrase: "happiest animal",
    manualOriginRevId: 729272914,
    expectedEngineOriginRevId: 609716334,
  },
  {
    name: "coati",
    article: "Coati",
    phrase: "Brazilian aardvark",
    manualOriginRevId: 229827595,
    expectedEngineOriginRevId: 225140818,
  },
  {
    name: "petasites",
    article: "Petasites",
    phrase: "pyrrolizidine alkaloids",
    manualOriginRevId: 322775877,
    expectedEngineOriginRevId: 110608704,
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
    const provenance = await traceClaim({
      article: f.article,
      phrase: f.phrase,
    });
    const origin = provenance.timeline.find(
      (e) => e.kind === "claim-introduced",
    );
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
