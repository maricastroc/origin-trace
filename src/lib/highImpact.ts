// Lexical detector for "high-impact" claims — sentences that make a strong
// rhetorical assertion (grandeur, reputation, records). No NLP: it is a set of
// regex signals split into two weighted tiers.
//
// STRONG signals — superlatives, consensus/reputation framing, records — each
// is, on its own, enough to mark a sentence as a strong claim (weight 2).
//
// SCOPE signals — absolute-scope phrases like "of all time" / "do mundo" — are
// weak on their own: "he visited several countries of the world" is not a claim
// of grandeur. They only tip a sentence over when paired with another signal
// (weight 1). This is what prevents scope words alone from inflating the count.
//
// A sentence is high-impact when its total score reaches THRESHOLD:
//   strong alone        → 2  ✓
//   scope alone         → 1  ✗  (the false positive the old `some()` let through)
//   strong + scope      → 3  ✓

const STRONG: RegExp[] = [
  /\b(?:widely |generally |often )?(?:regarded|considered|recognized|described|ranked|hailed|cited|seen) as\b/i,
  /\b(?:one of )?the (?:greatest|best|finest|largest|leading|foremost|most \w+)\b/i,
  /\bbest[- ](?:known|selling|regarded)\b/i,
  /\b(?:record[- ]?(?:breaking|setting)?|unprecedented|first (?:ever|person|player|team|to)|only (?:player|person|team))\b/i,

  /\b(?:é|foi|são|era) (?:considerad|reconhecid|apontad|tid|vist)[oa]s?\b/i,
  /\b(?:o|a|os|as|um dos|uma das) (?:maior|melhor|maiores|melhores)\b/i,
  // "mais bem pago do mundo", "mais vitorioso do mundo", "4º maior ... da
  // história" — superlative "mais" + up to 3 words + absolute scope. Requiring
  // "mais" is what keeps a bare "Copa do Mundo" out of the STRONG tier.
  /\bmais (?:\w+ ){1,3}(?:da história|de todos os tempos|do mundo|de sempre)\b/i,
  /\b(?:recorde|recordista|inédit[oa]|primeir[oa] (?:a|jogador|pessoa|time)|únic[oa])\b/i,
];

const SCOPE: RegExp[] = [
  /\b(?:of all time|in history|in the world|all[- ]time)\b/i,
  /\b(?:de todos os tempos|da história|do mundo|de sempre)\b/i,
];

const STRONG_WEIGHT = 2;
const SCOPE_WEIGHT = 1;
const THRESHOLD = 2;

/**
 * Weighted lexical intensity of a sentence's claim framing. Signals stack, so a
 * sentence that piles on superlative + reputation + scope scores higher than one
 * with a single superlative — useful for ranking, not just the boolean gate.
 */
export function highImpactScore(text: string): number {
  let score = 0;
  for (const re of STRONG) if (re.test(text)) score += STRONG_WEIGHT;
  for (const re of SCOPE) if (re.test(text)) score += SCOPE_WEIGHT;
  return score;
}

export function isHighImpact(text: string): boolean {
  return highImpactScore(text) >= THRESHOLD;
}
