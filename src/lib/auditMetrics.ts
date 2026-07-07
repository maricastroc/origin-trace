import type { AuditClaim } from "@/types/AuditClaim";
import type { AuditSection } from "@/types/AuditSection";
import { isHighImpact } from "./highImpact";

export interface SectionMetrics {
  total: number;
  sourced: number;
  noteOnly: number;
  unsourced: number;
  /** sourced / total — how much of the section carries an inline citation */
  coverage: number;
}

export function sectionMetrics(section: AuditSection): SectionMetrics {
  let sourced = 0;
  let noteOnly = 0;
  let unsourced = 0;
  for (const c of section.claims) {
    if (c.status === "sourced") sourced++;
    else if (c.status === "note-only") noteOnly++;
    else unsourced++;
  }
  const total = section.claims.length;
  return {
    total,
    sourced,
    noteOnly,
    unsourced,
    coverage: total === 0 ? 1 : sourced / total,
  };
}

export type AuditFilter = "all" | "attention" | "note" | "sourced" | "high";

export function matchesFilter(claim: AuditClaim, filter: AuditFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return claim.status === "unsourced";
    case "note":
      return claim.status === "note-only";
    case "sourced":
      return claim.status === "sourced";
    case "high":
      return claim.status !== "sourced" && isHighImpact(claim.text);
  }
}

export function countMatching(claims: AuditClaim[], filter: AuditFilter): number {
  let n = 0;
  for (const c of claims) if (matchesFilter(c, filter)) n++;
  return n;
}

export function sectionSlug(heading: string, index: number, isLead: boolean): string {
  const base = isLead
    ? "lead"
    : heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
  return `sec-${index}-${base || "section"}`;
}
