"use client";

import { useState } from "react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import { ClaimDrillDown } from "./ClaimDrillDown";

const DOT: Record<AuditClaim["status"], string> = {
  sourced: "bg-success",
  "note-only": "bg-warn",
  unsourced: "bg-danger",
};

export function ClaimRow({
  claim,
  article,
  muted,
  sectionLabel,
}: {
  claim: AuditClaim;
  article: ArticleAuditData["article"];
  muted: boolean;
  sectionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const traceable = claim.status !== "sourced";

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
          open
            ? "border-line-strong bg-surface-2"
            : "border-transparent hover:border-line hover:bg-surface-1/50"
        }`}
      >
        <span
          className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${DOT[claim.status]} ${
            muted ? "opacity-50" : ""
          }`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          {sectionLabel && (
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              {sectionLabel}
            </span>
          )}
          <span
            className={`text-[13.5px] leading-relaxed ${muted ? "text-ink-muted" : "text-ink"}`}
          >
            {claim.text}
          </span>
          {claim.source?.label && (
            <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-success/90">
              ↳ {claim.source.label}
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 shrink-0 font-mono text-[11px] transition-colors ${
            traceable
              ? "text-ink-faint group-hover:text-accent"
              : "text-ink-faint/60"
          }`}
        >
          {open ? "close" : traceable ? "trace →" : "history →"}
        </span>
      </button>

      {open && (
        <div className="animate-rise mt-1.5 mb-1">
          <ClaimDrillDown
            article={article.title}
            lang={article.lang}
            phrase={claim.text}
          />
        </div>
      )}
    </li>
  );
}
