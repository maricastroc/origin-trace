import { bodySections, cleanProse, sentences } from "./audit.ts";
import { extractAnchors } from "./anchors.ts";

// Deterministic body-claim sampler shared by the measurement harness and the
// inspection tool, so both operate on the *identical* set of claims (no drift
// between "what the benchmark measured" and "what the audit inspects").
//
// Body-only (lead + apparatus excluded via bodySections), raw sentences (so
// they normalize-match revision content), anchored, deduped, then spread evenly
// across the whole body — no Math.random, so runs repeat.
export function sampleBodyClaims(
  content: string,
  perArticle: number,
): { picks: string[]; candidates: number } {
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const sec of bodySections(content)) {
    for (const raw of sentences(sec.body)) {
      const clean = cleanProse(raw);
      if (clean.length < 40 || extractAnchors(clean).length === 0) continue;
      const key = clean.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(raw);
    }
  }
  return { picks: spread(candidates, perArticle), candidates: candidates.length };
}

// Pick n items evenly spread across the list (centered in each bucket).
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items.slice();
  const out: T[] = [];
  for (let k = 0; k < n; k++) {
    out.push(items[Math.min(Math.floor(((k + 0.5) * items.length) / n), items.length - 1)]);
  }
  return out;
}
