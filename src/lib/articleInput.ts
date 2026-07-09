export function parseArticleInput(raw: string): {
  title: string;
  lang?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { title: "" };

  const match = trimmed.match(
    /^(?:https?:\/\/)?([a-z-]{2,})\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i,
  );
  if (!match) return { title: trimmed };

  const lang = match[1].toLowerCase();
  let title = match[2];
  try {
    title = decodeURIComponent(title);
  } catch {
    //
  }
  title = title.replace(/_/g, " ").trim();
  return { title, lang };
}
