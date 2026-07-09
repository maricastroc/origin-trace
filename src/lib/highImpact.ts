const STRONG: RegExp[] = [
  /\b(?:widely |generally |often )?(?:regarded|considered|recognized|described|ranked|hailed|cited|seen) as\b/i,
  /\b(?:one of )?the (?:greatest|best|finest|largest|leading|foremost|most \w+)\b/i,
  /\bbest[- ](?:known|selling|regarded)\b/i,
  /\b(?:record[- ]?(?:breaking|setting)?|unprecedented|first (?:ever|person|player|team|to)|only (?:player|person|team))\b/i,

  /\b(?:é|foi|são|era) (?:considerad|reconhecid|apontad|tid|vist)[oa]s?\b/i,
  /\b(?:o|a|os|as|um dos|uma das) (?:maior|melhor|maiores|melhores)\b/i,
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

export function highImpactScore(text: string): number {
  let score = 0;
  for (const re of STRONG) if (re.test(text)) score += STRONG_WEIGHT;
  for (const re of SCOPE) if (re.test(text)) score += SCOPE_WEIGHT;
  return score;
}

export function isHighImpact(text: string): boolean {
  return highImpactScore(text) >= THRESHOLD;
}
