"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import { ClaimDrillDown } from "./ClaimDrillDown";
import { STATUS_META } from "./statusMeta";

export function HighImpactCard({
  claim,
  sectionLabel,
  article,
}: {
  claim: AuditClaim;
  sectionLabel: string;
  article: ArticleAuditData["article"];
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[claim.status];
  const StatusIcon = meta.Icon;

  return (
    <div
      className={`rounded-lg border bg-surface-2/70 transition-colors ${
        open ? "border-line-strong" : "border-line hover:border-line-strong"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 px-4 py-3.5 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {sectionLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <StatusIcon
              className={`h-3 w-3 shrink-0 ${meta.className}`}
              aria-hidden="true"
            />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              {meta.label}
            </span>
          </span>
        </div>

        <p className="text-[14px] leading-relaxed text-ink">{claim.text}</p>

        <span className="mt-1 flex items-center gap-1 font-mono text-[11px] text-accent">
          {open ? "close" : "trace this claim"}
          {!open && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
        </span>
      </button>

      {open && (
        <div className="animate-rise border-t border-line px-4 pb-4 pt-3">
          <ClaimDrillDown
            article={article.title}
            lang={article.lang}
            phrase={claim.text}
          />
        </div>
      )}
    </div>
  );
}
