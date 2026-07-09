"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { HighImpactItem } from "@/lib/auditModel";
import { HighImpactCard } from "./HighImpactCard";

const PREVIEW = 4;

export function HighImpactBand({
  items,
  article,
}: {
  items: HighImpactItem[];
  article: ArticleAuditData["article"];
}) {
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? items : items.slice(0, PREVIEW);

  const rest = items.length - shown.length;

  return (
    <section className="rounded-xl border border-accent/25 bg-accent-tint/25 p-4 sm:p-5">
      <div className="flex items-baseline gap-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          high-impact claims
        </p>
        <span className="font-mono text-[11px] text-ink-faint tabular-nums">
          {items.length}
        </span>
      </div>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
        Evaluative or record-setting statements — flagged by phrasing — that
        stand without an inline citation. The claims a reader is most likely to
        repeat, so the ones worth tracing first.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {shown.map((item) => (
          <HighImpactCard
            key={item.claim.id}
            claim={item.claim}
            sectionLabel={item.sectionLabel}
            article={article}
          />
        ))}
      </div>

      {rest > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint transition-colors hover:text-accent"
        >
          show {rest} more
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
