const PATTERNS: RegExp[] = [
  /\b(?:widely |generally |often )?(?:regarded|considered|recognized|described|ranked|hailed|cited|seen) as\b/i,
  /\b(?:one of )?the (?:greatest|best|finest|largest|leading|foremost|most \w+)\b/i,
  /\bbest[- ](?:known|selling|regarded)\b/i,
  /\b(?:record[- ]?(?:breaking|setting)?|unprecedented|first (?:ever|person|player|team|to)|only (?:player|person|team))\b/i,
  /\b(?:of all time|in history|in the world|all[- ]time)\b/i,

  /\b(?:é|foi|são|era) (?:considerad|reconhecid|apontad|tid|vist)[oa]s?\b/i,
  /\b(?:o|a|os|as|um dos|uma das) (?:maior|melhor|maiores|melhores)\b/i,
  /\bmais \w+ (?:da história|de todos os tempos|do mundo|de sempre)\b/i,
  /\b(?:de todos os tempos|da história|do mundo|de sempre)\b/i,
  /\b(?:recorde|recordista|inédit[oa]|primeir[oa] (?:a|jogador|pessoa|time)|únic[oa])\b/i,
];

export function isHighImpact(text: string): boolean {
  return PATTERNS.some((re) => re.test(text));
}
