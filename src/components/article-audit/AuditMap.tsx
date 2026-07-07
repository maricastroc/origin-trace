import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import type { AuditSection } from "@/types/AuditSection";
import { ClaimRow } from "./ClaimRow";

function SectionBlock({
  section,
  article,
}: {
  section: AuditSection;
  article: ArticleAuditData["article"];
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          {section.isLead ? "lead" : section.heading}
        </h3>
        {section.isLead && (
          <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
            cited in body by convention
          </span>
        )}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {section.claims.map((claim) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            article={article}
            muted={section.isLead}
          />
        ))}
      </ul>
    </section>
  );
}

export function AuditMap({ data }: { data: ArticleAuditData }) {
  return (
    <div className="flex flex-col gap-6">
      {data.sections.map((sec, i) => (
        <SectionBlock key={i} section={sec} article={data.article} />
      ))}
    </div>
  );
}
