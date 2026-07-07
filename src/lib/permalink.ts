"use client";

// Shareable-link plumbing. A result is reproducible from a handful of query
// params — no server state, no ids. The same params double as the dedupe key
// for local history, so encoding lives in one place.

type Params = Record<string, string | undefined>;

function clean(params: Params): [string, string][] {
  return Object.entries(params)
    .map(([k, v]) => [k, (v ?? "").trim()] as [string, string])
    .filter(([, v]) => v.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

/** Stable string for a set of params — used as a history dedupe key. */
export function paramsToKey(params: Params): string {
  const usp = new URLSearchParams(clean(params));
  return usp.toString();
}

/** Absolute URL a user can copy and share. */
export function shareUrl(params: Params): string {
  if (typeof window === "undefined") return "";
  const qs = new URLSearchParams(clean(params)).toString();
  return `${window.location.origin}${window.location.pathname}?${qs}`;
}

/**
 * Rewrite the address bar to reflect the current result, without a navigation.
 * Replaces the whole query so the URL always names exactly one result.
 */
export function updateUrl(params: Params): void {
  if (typeof window === "undefined") return;
  const qs = new URLSearchParams(clean(params)).toString();
  const { pathname, hash } = window.location;
  window.history.replaceState(null, "", qs ? `${pathname}?${qs}${hash}` : `${pathname}${hash}`);
}

/** Read the current query string once (client-side). */
export function readParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}
