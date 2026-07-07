"use client";
type Params = Record<string, string | undefined>;

function clean(params: Params): [string, string][] {
  return Object.entries(params)
    .map(([k, v]) => [k, (v ?? "").trim()] as [string, string])
    .filter(([, v]) => v.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

export function paramsToKey(params: Params): string {
  const usp = new URLSearchParams(clean(params));
  return usp.toString();
}

export function shareUrl(params: Params): string {
  if (typeof window === "undefined") return "";
  const qs = new URLSearchParams(clean(params)).toString();
  return `${window.location.origin}${window.location.pathname}?${qs}`;
}

export function updateUrl(params: Params): void {
  if (typeof window === "undefined") return;
  const qs = new URLSearchParams(clean(params)).toString();
  const { pathname, hash } = window.location;
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}${hash}` : `${pathname}${hash}`);
}

export function readParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}
