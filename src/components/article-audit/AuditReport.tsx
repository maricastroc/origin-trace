"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  CircleX,
  List,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import { STATUS_META } from "./statusMeta";
import {
  matchesFilter,
  matchesQuery,
  type AuditFilter,
  type AuditSort,
} from "@/lib/auditMetrics";
import { buildAuditModel } from "@/lib/auditModel";
import { AuditSummary } from "./AuditSummary";
import { AuditMap } from "./AuditMap";
import { AuditSidebar } from "./AuditSidebar";
import { FilterControl, type ControlOption } from "./FilterControl";
import { HighImpactBand } from "./HighImpactBand";

export function AuditReport({ data }: { data: ArticleAuditData }) {
  const [filter, setFilter] = useState<AuditFilter>("all");

  const [sort, setSort] = useState<AuditSort>("article");

  const [query, setQuery] = useState("");

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const model = useMemo(() => buildAuditModel(data), [data]);

  const filterOptions = useMemo<ControlOption<AuditFilter>[]>(() => {
    const { sourced, noteOnly, unsourced, sentences } = model.totals;

    const opts: ControlOption<AuditFilter>[] = [
      { key: "all", label: "Everything", count: sentences, Icon: List },
      {
        key: "sourced",
        label: "Inline citation",
        count: sourced,
        Icon: STATUS_META.sourced.Icon,
        iconClass: STATUS_META.sourced.className,
      },
      {
        key: "note",
        label: "Note, not a source",
        count: noteOnly,
        Icon: STATUS_META["note-only"].Icon,
        iconClass: STATUS_META["note-only"].className,
      },
      {
        key: "attention",
        label: "No inline citation",
        count: unsourced,
        Icon: STATUS_META.unsourced.Icon,
        iconClass: STATUS_META.unsourced.className,
      },
      {
        key: "high",
        label: "High-impact",
        count: model.highImpact.length,
        Icon: Star,
        iconClass: "text-accent",
      },
    ];

    return opts.filter((o) => o.key === "all" || (o.count ?? 0) > 0);
  }, [model]);

  const sortOptions = useMemo<ControlOption<AuditSort>[]>(() => {
    const opts: ControlOption<AuditSort>[] = [
      { key: "article", label: "Article order", Icon: AlignLeft },
      { key: "coverage-asc", label: "Lowest coverage", Icon: TrendingDown },
      { key: "coverage-desc", label: "Highest coverage", Icon: TrendingUp },
      { key: "uncited", label: "Most uncited", Icon: CircleX },
      { key: "high", label: "Most high-impact", Icon: Star },
    ];

    return model.highImpact.length > 0
      ? opts
      : opts.filter((o) => o.key !== "high");
  }, [model]);

  const active = filter !== "all" || query.trim() !== "";

  const predicate = (claim: AuditClaim) =>
    matchesFilter(claim, filter) && matchesQuery(claim.text, query);

  const railRef = useRef<HTMLDivElement>(null);

  const [railH, setRailH] = useState<number | null>(null);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRailH(el.offsetHeight));
    ro.observe(el);
    setRailH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  function toggle(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <AuditSummary data={data} model={model} />

      {model.highImpact.length > 0 && (
        <HighImpactBand items={model.highImpact} article={data.article} />
      )}

      <div className="flex flex-col gap-3 lg:hidden">
        <FilterControl
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          variant="pills"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            sort
          </span>
          <FilterControl
            options={sortOptions}
            value={sort}
            onChange={setSort}
            variant="pills"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-[1fr_236px] lg:items-start">
        <AuditMap
          data={data}
          predicate={predicate}
          active={active}
          query={query}
          onQuery={setQuery}
          sort={sort}
          expanded={expanded}
          onToggle={toggle}
          mapHeight={railH}
        />
        <AuditSidebar
          panelRef={railRef}
          filter={filter}
          filterOptions={filterOptions}
          onFilter={setFilter}
          sort={sort}
          sortOptions={sortOptions}
          onSort={setSort}
        />
      </div>
    </div>
  );
}
