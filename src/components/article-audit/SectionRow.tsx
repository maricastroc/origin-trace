import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditSection } from "@/types/AuditSection";
import {
  matchesFilter,
  sectionMetrics,
  sectionSlug,
  type AuditFilter,
} from "@/lib/auditMetrics";
import { ClaimRow } from "./ClaimRow";
import { SegBar } from "./SegBar";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 text-ink-faint transition-transform duration-200 ${
        open ? "rotate-90" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 2.5 8.5 6l-4 3.5" />
    </svg>
  );
}

export function SectionRow({
  section,
  index,
  article,
  filter,
  open,
  onToggle,
}: {
  section: AuditSection;
  index: number;
  article: ArticleAuditData["article"];
  filter: AuditFilter;
  open: boolean;
  onToggle: () => void;
}) {
  const m = sectionMetrics(section);
  const slug = sectionSlug(section.heading, index, section.isLead);
  const filtered = filter !== "all";
  const isOpen = open || filtered;
  const claims = filtered
    ? section.claims.filter((c) => matchesFilter(c, filter))
    : section.claims;
  const pct = Math.round(m.coverage * 100);

  return (
    <div id={slug} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-3 text-left transition-colors hover:bg-surface-1/60"
      >
        <Chevron open={isOpen} />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted transition-colors group-hover:text-ink">
          {section.isLead ? "lead" : section.heading}
        </span>
        {section.isLead && (
          <span className="hidden shrink-0 rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint sm:inline">
            cited in body by convention
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="hidden w-14 text-right font-mono text-[11px] text-ink-faint tabular-nums sm:inline">
            {filtered
              ? `${claims.length} shown`
              : m.unsourced > 0
                ? `${m.unsourced} uncited`
                : "all cited"}
          </span>
          <SegBar
            sourced={m.sourced}
            noteOnly={m.noteOnly}
            unsourced={m.unsourced}
            className="h-1.5 w-16 sm:w-24"
          />
          <span className="w-9 text-right font-mono text-[12px] text-ink-muted tabular-nums">
            {pct}%
          </span>
        </span>
      </button>

      {isOpen && claims.length > 0 && (
        <ul className="animate-rise ml-[15px] mt-0.5 mb-1 flex flex-col gap-1 border-l border-line pl-3.5">
          {claims.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              article={article}
              muted={section.isLead}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
