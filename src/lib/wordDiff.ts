/**
 * A word-level diff between two wordings, via the same longest-common-subsequence
 * the engine's genealogy uses over sentences — here over tokens, so the UI can
 * render one wording morphing into the next (kept words, dropped words, new
 * words). Tokens are compared on their alphanumeric core, case-insensitively, so
 * punctuation and casing don't register as changes; the original text is what's
 * rendered.
 */

export interface DiffToken {
  text: string;
  op: "same" | "add" | "del";
}

function core(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function wordDiff(prev: string, next: string): DiffToken[] {
  const a = prev.split(/\s+/).filter(Boolean);
  const b = next.split(/\s+/).filter(Boolean);

  const m = a.length;
  const n = b.length;

  // LCS lengths, filled from the bottom-right so the walk below is forward.
  const dp: Int32Array[] = Array.from(
    { length: m + 1 },
    () => new Int32Array(n + 1),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        core(a[i]) === core(b[j])
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (core(a[i]) === core(b[j])) {
      out.push({ text: b[j], op: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ text: a[i], op: "del" });
      i++;
    } else {
      out.push({ text: b[j], op: "add" });
      j++;
    }
  }
  while (i < m) out.push({ text: a[i++], op: "del" });
  while (j < n) out.push({ text: b[j++], op: "add" });
  return out;
}
