"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { investigations, PHENOMENA, phenomenonById } from "@/investigations";
import type { PhenomenonId } from "@/investigations";
import { AuditReport } from "../article-audit/AuditReport";
import { CaseFile } from "../case-file/CaseFile";
import { InvestigationCard } from "./InvestigationCard";
import { asAudit, isTrace, verifyHref } from "./view";

type Filter = PhenomenonId | "all";

export function Investigations() {
  const [filter, setFilter] = useState<Filter>("all");

  const [activeSlug, setActiveSlug] = useState<string | undefined>(undefined);

  const filters = useMemo(() => {
    const present = new Set(investigations.map((i) => i.phenomenon));
    return PHENOMENA.filter((p) => present.has(p.id));
  }, []);

  const visible = useMemo(
    () =>
      filter === "all"
        ? investigations
        : investigations.filter((i) => i.phenomenon === filter),
    [filter],
  );

  const active = activeSlug
    ? visible.find((i) => i.slug === activeSlug)
    : undefined;

  function pick(next: Filter) {
    setFilter(next);
    const list =
      next === "all"
        ? investigations
        : investigations.filter((i) => i.phenomenon === next);

    if (activeSlug && !list.some((i) => i.slug === activeSlug)) {
      setActiveSlug(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          count={investigations.length}
          active={filter === "all"}
          onClick={() => pick("all")}
        />
        {filters.map((p) => (
          <FilterChip
            key={p.id}
            label={p.label}
            count={investigations.filter((i) => i.phenomenon === p.id).length}
            active={filter === p.id}
            onClick={() => pick(p.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((inv) => (
          <InvestigationCard
            key={inv.slug}
            inv={inv}
            active={inv.slug === activeSlug}
            onSelect={() =>
              setActiveSlug((prev) => (prev === inv.slug ? undefined : inv.slug))
            }
          />
        ))}
      </div>

      {active && (
        <div key={active.slug} className="animate-rise flex flex-col gap-5">
          <div className="rounded-2xl border border-line bg-surface-1/45 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-md font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                {phenomenonById(active.phenomenon).blurb}
              </p>
              <a
                href={verifyHref(active)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-muted transition-colors hover:border-ink hover:text-ink"
              >
                verify live
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink">
              {active.narrative}
            </p>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-faint">
              traced by the engine · pinned {active.pinnedAt} · receipt in the
              timeline
            </p>
          </div>

          <div className="rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_30px_60px_-40px_rgba(90,60,30,0.4)] sm:p-8">
            {isTrace(active) ? (
              <CaseFile data={active.data} />
            ) : (
              <AuditReport data={asAudit(active)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
        active
          ? "border-accent bg-accent/10 text-ink"
          : "border-line-strong text-ink-muted hover:border-ink hover:text-ink"
      }`}
    >
      {label}
      <span className="font-mono text-[10.5px] text-ink-faint">{count}</span>
    </button>
  );
}
