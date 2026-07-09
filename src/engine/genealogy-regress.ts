// Genealogy regression suite — the pinned correctness gate.
//
// Runs the hand-audited real cases live and asserts the invariant that closed
// Camada 1: false links must NOT be asserted as provenance (no verdict-shift),
// and genuine retrofits must keep theirs. The offline synthetic tests in
// genealogy.test.ts protect the *mechanism* deterministically; this suite pins
// the *real Wikipedia cases* we audited, so a future change that re-breaks one
// of them is caught end-to-end.
//
// The hard invariant is the verdict-shift (present / absent) — the ship-critical
// safety property. `abstain` is informational: whether the chain stops at the
// low-overlap guard (drift can change chain shape, so it never fails the run).
// A case whose phrase no longer locates (the article was reworded away) SKIPs.
//
//   npm run engine:regress

import type { EngineCache } from "./cache.ts";
import { ClaimNotFoundError } from "./trace.ts";
import { reconstructGenealogy, type Genealogy } from "./genealogy.ts";
import { WikipediaClient, type RevisionList } from "./wikipedia.ts";

class RegressCache implements EngineCache {
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

interface Case {
  label: string;
  article: string;
  phrase: string; // a distinctive fragment of the audited claim's current wording
  expectShift: boolean; // hard invariant: must a verdict-shift be present?
  expectAbstain?: boolean; // informational: should the chain stop at the overlap guard?
  note: string;
}

// The cases audited in the correctness gate (see NOTES / memory). Verdicts refer
// to the shift the *lexical* trace would assert vs. what genealogy concludes.
const CASES: Case[] = [
  // ── False links that must stay abstained (no laundered provenance) ──
  {
    label: "penicillin-paine",
    article: "Penicillin",
    phrase: "successfully treated ophthalmia neonatorum",
    expectShift: false,
    expectAbstain: true,
    note: "Paine 'ophthalmia, success' (sourced) must NOT be traced back to the different 2008 'sycosis, failure' claim.",
  },
  {
    label: "great-wall-palisade",
    article: "Great Wall of China",
    phrase: "meant to prevent Han Chinese migration into Manchuria",
    expectShift: false,
    note: "Willow Palisade purpose (sourced) must NOT be laundered back to the 2011 'built by the Qing' claim.",
  },
  {
    label: "photosynthesis-nadp",
    article: "Photosynthesis",
    phrase: "reduce the coenzyme NADP",
    expectShift: false,
    expectAbstain: true,
    note: "The electron→NADPH claim must NOT deep-link to the different 'cyclic reaction generates ATP' sentence.",
  },
  {
    label: "darwin-scotland",
    article: "Charles Darwin",
    phrase: "took a break and went",
    expectShift: false,
    expectAbstain: true,
    note: "The Scotland geologising trip must NOT link to the Whewell/Secretary sentence on a bare shared year.",
  },
  {
    label: "french-rev-hebert",
    article: "French Revolution",
    phrase: "called for a popular revolt against the",
    expectShift: false,
    expectAbstain: true,
    note: "Hébert's arrest must NOT link to the different 'Girondins arrested' sentence via a shared name.",
  },
  // ── Genuine retrofits that must keep their verdict-shift ──
  {
    label: "curie-hospitalised",
    article: "Marie Curie",
    phrase: "hospitalised with depression and a kidney ailment",
    expectShift: true,
    note: "Same claim copy-edited from 2006 (unsourced) to 2012 (sourced) — a real retrofit.",
  },
  {
    label: "curie-einstein",
    article: "Marie Curie",
    phrase: "the only person who could not be corrupted by fame",
    expectShift: true,
    note: "Einstein's remark, same claim reworded, unsourced at 2008 origin — a real retrofit.",
  },
];

async function evaluate(g: Genealogy, c: Case): Promise<{ pass: boolean; abstained: boolean }> {
  const hasShift = g.verdictShift !== null;
  const pass = hasShift === c.expectShift;
  const abstained = g.terminus === "broke:low-overlap";
  return { pass, abstained };
}

async function main(): Promise<number> {
  const cache = new RegressCache();
  let failures = 0;
  let skips = 0;

  for (const c of CASES) {
    try {
      const g = await reconstructGenealogy({ article: c.article, phrase: c.phrase, cache });
      const { pass, abstained } = await evaluate(g, c);
      const shift = g.verdictShift ? `${g.verdictShift.from}→${g.verdictShift.to}` : "none";
      const mark = pass ? "✓" : "✗";
      process.stdout.write(
        `${mark} ${c.label.padEnd(22)} shift=${shift.padEnd(28)} terminus=${g.terminus}\n`,
      );
      if (!pass) {
        failures++;
        process.stdout.write(`    expected shift ${c.expectShift ? "present" : "absent"} — ${c.note}\n`);
      }
      if (c.expectAbstain && !abstained) {
        process.stdout.write(`    · note: expected to abstain (broke:low-overlap) but got ${g.terminus} — check if the article drifted\n`);
      }
    } catch (err) {
      if (err instanceof ClaimNotFoundError) {
        skips++;
        process.stdout.write(`~ ${c.label.padEnd(22)} SKIP — phrase no longer in the article (drifted)\n`);
      } else {
        throw err;
      }
    }
  }

  process.stdout.write(
    `\n${failures === 0 ? "PASS" : "FAIL"} — ${CASES.length - failures - skips}/${CASES.length} verified` +
      `${skips ? `, ${skips} skipped (drift)` : ""}${failures ? `, ${failures} FAILED` : ""}\n`,
  );
  return failures === 0 ? 0 : 1;
}

main().then((code) => {
  process.exitCode = code;
});
