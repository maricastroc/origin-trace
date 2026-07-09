import type { EngineCache } from "./cache.ts";
import { ClaimNotFoundError } from "./trace.ts";
import { reconstructGenealogy, type Genealogy } from "./genealogy.ts";
import { type RevisionList } from "./wikipedia.ts";

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
  phrase: string;
  expectShift: boolean;
  expectAbstain?: boolean;
  note: string;
}

const CASES: Case[] = [
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

async function evaluate(
  g: Genealogy,
  c: Case,
): Promise<{ pass: boolean; abstained: boolean }> {
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
      const g = await reconstructGenealogy({
        article: c.article,
        phrase: c.phrase,
        cache,
      });
      const { pass, abstained } = await evaluate(g, c);
      const shift = g.verdictShift
        ? `${g.verdictShift.from}→${g.verdictShift.to}`
        : "none";
      const mark = pass ? "✓" : "✗";
      process.stdout.write(
        `${mark} ${c.label.padEnd(22)} shift=${shift.padEnd(28)} terminus=${g.terminus}\n`,
      );
      if (!pass) {
        failures++;
        process.stdout.write(
          `    expected shift ${c.expectShift ? "present" : "absent"} — ${c.note}\n`,
        );
      }
      if (c.expectAbstain && !abstained) {
        process.stdout.write(
          `    · note: expected to abstain (broke:low-overlap) but got ${g.terminus} — check if the article drifted\n`,
        );
      }
    } catch (err) {
      if (err instanceof ClaimNotFoundError) {
        skips++;
        process.stdout.write(
          `~ ${c.label.padEnd(22)} SKIP — phrase no longer in the article (drifted)\n`,
        );
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
