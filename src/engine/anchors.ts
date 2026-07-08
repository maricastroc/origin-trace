// Deterministic anchor extraction.
//
// An "anchor" is a high-specificity, reformulation-stable token of a claim:
// a number/date or a proper noun. Rewordings that preserve the *fact* tend to
// preserve these even when they swap the verbs and function words around them
// ("founded in 1998" → "began operations in 1998" both keep 1998). Genealogy
// uses anchor overlap as the guard that a positional replacement is the *same
// idea* descending, not an unrelated sentence that happened to occupy the slot.
//
// No NLP, no model — pure lexical rules, so the guard stays reproducible.

export type AnchorKind = "number" | "name";

export interface Anchor {
  kind: AnchorKind;
  value: string;
}

// Capitalized words that are almost always sentence scaffolding rather than
// proper nouns. Filtered so a sentence-initial "The"/"During" isn't mistaken
// for an entity, while a genuine leading subject ("Petasites", "Neymar") is
// still kept.
const STOPWORDS = new Set([
  "the", "a", "an", "this", "that", "these", "those", "it", "its", "he", "she",
  "they", "his", "her", "their", "them", "some", "many", "most", "several",
  "other", "such", "each", "both", "all", "in", "on", "at", "by", "for", "from",
  "with", "as", "of", "to", "and", "or", "but", "if", "when", "while", "after",
  "before", "during", "since", "until", "although", "though", "however",
  "because", "between", "among", "over", "under", "about", "into", "through",
  "there", "here", "then", "also", "not", "no", "one", "two", "three", "first",
  "second", "later", "early", "his", "originally", "according",
]);

const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;
const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const MONTH_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;

/**
 * Stable anchors of a sentence: numbers with ≥2 significant digits, proper
 * nouns (capitalized, non-stopword words), and month names. Case-folded and
 * de-duplicated. Single-digit numbers are dropped — a shared "3" is too weak
 * to guard a genealogy link on.
 */
export function extractAnchors(sentence: string): Anchor[] {
  const out: Anchor[] = [];
  const seen = new Set<string>();
  const add = (kind: AnchorKind, value: string) => {
    if (!value) return;
    const key = `${kind}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value });
  };

  for (const m of sentence.matchAll(NUMBER_RE)) {
    const digits = m[0].replace(/[^\d]/g, "");
    if (digits.length >= 2) add("number", digits);
  }

  const words = [...sentence.matchAll(WORD_RE)].map((m) => m[0]);
  words.forEach((word, idx) => {
    if (word.length < 2) return;
    if (!/^[A-Z]/.test(word)) return;
    if (STOPWORDS.has(word.toLowerCase())) return;
    // A capitalized word at the very start of a sentence is ambiguous: it could
    // be a proper noun ("Pluto") or just a capitalized common word ("Near",
    // "Training"). Keep it only when the next word is also capitalized (a
    // multi-word proper noun like "Mount Everest"); otherwise drop it rather
    // than let a false name loosen the link guard.
    if (idx === 0) {
      const next = words[1];
      if (!next || !/^[A-Z]/.test(next)) return;
    }
    add("name", word.toLowerCase());
  });

  for (const m of sentence.matchAll(MONTH_RE)) {
    add("name", m[1].toLowerCase());
  }

  return out;
}

function anchorKey(a: Anchor): string {
  return `${a.kind}:${a.value}`;
}

/** Anchors present in both sentences (the intersection used as the link guard). */
export function sharedAnchors(a: string, b: string): Anchor[] {
  const inB = new Set(extractAnchors(b).map(anchorKey));
  const out: Anchor[] = [];
  const seen = new Set<string>();
  for (const anchor of extractAnchors(a)) {
    const key = anchorKey(anchor);
    if (inB.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(anchor);
    }
  }
  return out;
}

/** True when the sentence carries at least one stable anchor to trace on. */
export function hasAnchors(sentence: string): boolean {
  return extractAnchors(sentence).length > 0;
}
