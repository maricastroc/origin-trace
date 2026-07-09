import type { Investigation } from "@/investigations";
import type { ArticleAudit } from "@/types/ArticleAudit";
import type { ClaimProvenance } from "@/types/ClaimProvenance";

const enc = encodeURIComponent;

export function isTrace(
  inv: Investigation,
): inv is Investigation & { data: ClaimProvenance } {
  return inv.seed.kind === "trace";
}

export function asAudit(inv: Investigation): ArticleAudit {
  return inv.data as ArticleAudit;
}

export function verifyHref(inv: Investigation): string {
  const { seed } = inv;

  const langQ =
    seed.lang && seed.lang !== "en" ? `&lang=${enc(seed.lang)}` : "";

  return seed.kind === "trace"
    ? `/?trace=${enc(seed.phrase)}&article=${enc(seed.article)}${langQ}`
    : `/?audit=${enc(seed.article)}${langQ}`;
}

export function coveragePct(inv: Investigation): number {
  return Math.round(asAudit(inv).summary.coverage * 100);
}
