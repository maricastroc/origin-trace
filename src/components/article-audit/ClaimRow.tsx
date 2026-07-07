"use client";

import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditClaim } from "@/types/AuditClaim";
import { ClaimDrillDown } from "./ClaimDrillDown";
import { STATUS_META } from "./statusMeta";

function highlight(text: string, query?: string): React.ReactNode {
  const q = query?.trim().toLowerCase();
  if (!q) return text;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(q, i);
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={idx} className="rounded-[3px] bg-accent-tint px-0.5 text-ink">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
    idx = lower.indexOf(q, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

export function ClaimRow({
  claim,
  article,
  muted,
  sectionLabel,
  query,
}: {
  claim: AuditClaim;
  article: ArticleAuditData["article"];
  muted: boolean;
  sectionLabel?: string;
  query?: string;
}) {
  const [open, setOpen] = useState(false);
  const traceable = claim.status !== "sourced";
  const StatusIcon = STATUS_META[claim.status].Icon;

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
        <StatusIcon
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${STATUS_META[claim.status].className} ${
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
            {highlight(claim.text, query)}
          </span>
          {claim.source?.label && (
            <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11px] text-success/90">
              <Link2 className="h-3 w-3" aria-hidden="true" />
              {claim.source.label}
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center gap-1 font-mono text-[11px] transition-colors ${
            traceable
              ? "text-ink-faint group-hover:text-accent"
              : "text-ink-faint/60"
          }`}
        >
          {open ? (
            "close"
          ) : (
            <>
              {traceable ? "trace" : "history"}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </>
          )}
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
