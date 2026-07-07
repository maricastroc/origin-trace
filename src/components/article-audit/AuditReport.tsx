"use client";

import { useMemo, useState } from "react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import { sectionSlug, type AuditFilter } from "@/lib/auditMetrics";
import { buildAuditModel } from "@/lib/auditModel";
import { AuditSummary } from "./AuditSummary";
import { AuditMap } from "./AuditMap";
import { AuditSidebar } from "./AuditSidebar";
import { FilterControl, type FilterOption } from "./FilterControl";
import { HighImpactBand } from "./HighImpactBand";

export function AuditReport({ data }: { data: ArticleAuditData }) {
  const [filter, setFilter] = useState<AuditFilter>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const model = useMemo(() => buildAuditModel(data), [data]);

  const options = useMemo<FilterOption[]>(() => {
    const { sourced, noteOnly, unsourced, sentences } = model.totals;
    const opts: FilterOption[] = [
      { key: "all", label: "Everything", count: sentences },
      { key: "attention", label: "Needs attention", count: unsourced, dot: "bg-danger/80" },
      { key: "high", label: "High-impact", count: model.highImpact.length, dot: "bg-accent" },
      { key: "note", label: "Note only", count: noteOnly, dot: "bg-warn" },
      { key: "sourced", label: "Well-sourced", count: sourced, dot: "bg-success" },
    ];
    return opts.filter((o) => o.key === "all" || o.count > 0);
  }, [model]);

  function toggle(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function jump(index: number) {
    setExpanded((prev) => new Set(prev).add(index));
    const section = data.sections[index];
    const slug = sectionSlug(section.heading, index, section.isLead);
    // let the newly-expanded row paint before scrolling to it
    requestAnimationFrame(() => {
      document.getElementById(slug)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <AuditSummary data={data} model={model} />

      {model.highImpact.length > 0 && (
        <HighImpactBand items={model.highImpact} article={data.article} />
      )}

      <div className="lg:hidden">
        <FilterControl
          options={options}
          value={filter}
          onChange={setFilter}
          variant="pills"
        />
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-[1fr_236px]">
        <AuditMap
          data={data}
          filter={filter}
          expanded={expanded}
          onToggle={toggle}
        />
        <AuditSidebar
          model={model}
          filter={filter}
          options={options}
          onFilter={setFilter}
          onJump={jump}
        />
      </div>
    </div>
  );
}
