export type AnchorKind = "number" | "name";

export interface Anchor {
  kind: AnchorKind;
  value: string;
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "he",
  "she",
  "they",
  "his",
  "her",
  "their",
  "them",
  "some",
  "many",
  "most",
  "several",
  "other",
  "such",
  "each",
  "both",
  "all",
  "in",
  "on",
  "at",
  "by",
  "for",
  "from",
  "with",
  "as",
  "of",
  "to",
  "and",
  "or",
  "but",
  "if",
  "when",
  "while",
  "after",
  "before",
  "during",
  "since",
  "until",
  "although",
  "though",
  "however",
  "because",
  "between",
  "among",
  "over",
  "under",
  "about",
  "into",
  "through",
  "there",
  "here",
  "then",
  "also",
  "not",
  "no",
  "one",
  "two",
  "three",
  "first",
  "second",
  "later",
  "early",
  "his",
  "originally",
  "according",
]);

const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;
const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const MONTH_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;

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

export function hasAnchors(sentence: string): boolean {
  return extractAnchors(sentence).length > 0;
}
