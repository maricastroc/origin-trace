const LANG_RE = /^[a-z][a-z0-9-]{1,11}$/;

export function safeLang(raw: string | null | undefined): string {
  const code = raw?.trim().toLowerCase() ?? "";
  return LANG_RE.test(code) ? code : "en";
}
