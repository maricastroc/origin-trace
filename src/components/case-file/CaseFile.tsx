import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { CaseFileHeader } from "./CaseFileHeader";
import { CircularLoop } from "./CircularLoop";
import { CredibilityRead } from "./CredibilityRead";
import { DualReadings } from "./DualReadings";
import { ProvenanceFooter } from "./ProvenanceFooter";
import { SourceQualityNote } from "./SourceQualityNote";
import { Timeline } from "./Timeline";
import { VerdictSummary } from "./VerdictSummary";

export function CaseFile({ data }: { data: ClaimProvenance }) {
  const isAmbiguous = data.verdict.primary === "ambiguous";
  return (
    <article className="flex flex-col gap-6">
      <CaseFileHeader claim={data.claim} verdict={data.verdict} />
      <Timeline
        events={data.timeline}
        label={isAmbiguous ? "Chain of rewording" : "Credibility timeline"}
        subtitle={
          isAmbiguous
            ? "the protagonist — how the wording and evidence changed; between them, the kind of change"
            : "the protagonist — each node is an auditable revision; between them, what changed"
        }
      />
      {data.annotations?.circularLoop && (
        <CircularLoop loop={data.annotations.circularLoop} />
      )}
      {isAmbiguous && data.verdict.readings && (
        <DualReadings readings={data.verdict.readings} />
      )}
      <CredibilityRead text={data.credibilityRead} />
      {data.sourceQuality && <SourceQualityNote quality={data.sourceQuality} />}
      <VerdictSummary verdict={data.verdict} />
      <ProvenanceFooter meta={data.meta} />
    </article>
  );
}
