import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { CaseFileHeader } from "./CaseFileHeader";
import { CircularLoop } from "./CircularLoop";
import { CorpusReceipt } from "./CorpusReceipt";
import { CredibilityRead } from "./CredibilityRead";
import { DualReadings } from "./DualReadings";
import { EvidenceStatus } from "./EvidenceStatus";
import { ProvenanceFooter } from "./ProvenanceFooter";
import { SourceQualityNote } from "./SourceQualityNote";
import { Timeline } from "./Timeline";

export function CaseFile({ data }: { data: ClaimProvenance }) {
  const isAmbiguous = data.verdict.primary === "ambiguous";
  return (
    <article className="flex flex-col gap-6">
      <CaseFileHeader claim={data.claim} />
      <EvidenceStatus data={data} />
      {data.meta.corpus && (
        <CorpusReceipt
          corpus={data.meta.corpus}
          manual={data.meta.generatedBy === "manual-trace"}
        />
      )}
      <Timeline
        events={data.timeline}
        label={isAmbiguous ? "Chain of rewording" : "Credibility timeline"}
        subtitle={
          isAmbiguous
            ? "the evidence for the verdict — how the wording and evidence changed; between them, the kind of change"
            : "the evidence for the verdict — each node is an auditable revision; between them, what changed"
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
      <ProvenanceFooter meta={data.meta} />
    </article>
  );
}
