import { bodySections, cleanProse, sentences } from "./audit.ts";
import { extractAnchors } from "./anchors.ts";

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
  return {
    picks: spread(candidates, perArticle),
    candidates: candidates.length,
  };
}

function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items.slice();
  const out: T[] = [];
  for (let k = 0; k < n; k++) {
    out.push(
      items[
        Math.min(Math.floor(((k + 0.5) * items.length) / n), items.length - 1)
      ],
    );
  }
  return out;
}
