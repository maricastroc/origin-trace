/**
 * Normalizes a user-typed article scope. Accepts either a bare title
 * ("Neymar") or a full Wikipedia URL and returns the clean title — plus the
 * language subdomain when the input was a URL, so a pasted pt.wikipedia link
 * can retarget the trace without the user touching the language picker.
 */
export function parseArticleInput(raw: string): { title: string; lang?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { title: "" };

  // e.g. https://pt.wikipedia.org/wiki/Neymar , en.m.wikipedia.org/wiki/Animal_Farm
  const match = trimmed.match(
    /^(?:https?:\/\/)?([a-z-]{2,})\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i,
  );
  if (!match) return { title: trimmed };

  const lang = match[1].toLowerCase();
  let title = match[2];
  try {
    title = decodeURIComponent(title);
  } catch {
    // leave the raw (possibly malformed) escape sequence as-is
  }
  title = title.replace(/_/g, " ").trim();
  return { title, lang };
}
