import type { ArticleAudit } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import { sectionMetrics, type SectionMetrics } from "./auditMetrics";
import { isHighImpact } from "./highImpact";

export interface HighImpactItem {
  claim: AuditClaim;
  sectionLabel: string;
}

export interface RankedSection {
  index: number;
  label: string;
  metrics: SectionMetrics;
}

export interface UncitedRun {
  count: number;
  label: string;
}

export interface AuditModel {
  totals: { sourced: number; noteOnly: number; unsourced: number; sentences: number };
  sectionCount: number;
  highImpact: HighImpactItem[];
  worstSections: RankedSection[];
  bestSection: RankedSection | null;
  longestRun: UncitedRun | null;
}

/** Sections small enough that a coverage ratio is noise, not signal. */
const RANKABLE_MIN = 3;

export function buildAuditModel(data: ArticleAudit): AuditModel {
  let sourced = 0;
  let noteOnly = 0;
  let unsourced = 0;
  const highImpact: HighImpactItem[] = [];
  const ranked: RankedSection[] = [];
  const longestRun: UncitedRun = { count: 0, label: "" };

  data.sections.forEach((section, index) => {
    const label = section.isLead ? "Lead" : section.heading;
    const m = sectionMetrics(section);

    for (const claim of section.claims) {
      if (claim.status === "sourced") sourced++;
      else if (claim.status === "note-only") noteOnly++;
      else unsourced++;
      if (claim.status !== "sourced" && isHighImpact(claim.text)) {
        highImpact.push({ claim, sectionLabel: label });
      }
    }

    if (!section.isLead && m.total >= RANKABLE_MIN) {
      ranked.push({ index, label, metrics: m });
    }

    if (!section.isLead) {
      let run = 0;
      for (const claim of section.claims) {
        if (claim.status === "unsourced") {
          run++;
          if (run > longestRun.count) {
            longestRun.count = run;
            longestRun.label = label;
          }
        } else {
          run = 0;
        }
      }
    }
  });

  const byCoverage = [...ranked].sort(
    (a, b) => a.metrics.coverage - b.metrics.coverage,
  );

  return {
    totals: { sourced, noteOnly, unsourced, sentences: sourced + noteOnly + unsourced },
    sectionCount: data.sections.filter((s) => !s.isLead).length,
    highImpact,
    worstSections: byCoverage.slice(0, 5),
    bestSection: byCoverage.length ? byCoverage[byCoverage.length - 1] : null,
    longestRun: longestRun.count >= 3 ? longestRun : null,
  };
}
