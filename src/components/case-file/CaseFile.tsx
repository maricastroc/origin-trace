import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { TraceMetrics } from "@/engine/metrics";
import { CaseFileHeader } from "./CaseFileHeader";
import { CircularLoop } from "./CircularLoop";
import { CorpusReceipt } from "./CorpusReceipt";
import { CredibilityRead } from "./CredibilityRead";
import { DualReadings } from "./DualReadings";
import { EngineReceipt } from "./EngineReceipt";
import { EvidenceStatus } from "./EvidenceStatus";
import { ProvenanceFooter } from "./ProvenanceFooter";
import { SearchDescent } from "./SearchDescent";
import { SourceQualityNote } from "./SourceQualityNote";
import { Timeline } from "./Timeline";

export function CaseFile({
  data,
  metrics,
}: {
  data: ClaimProvenance;
  metrics?: TraceMetrics;
}) {
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
      {data.search && (
        <SearchDescent
          corpusSize={data.search.corpusSize}
          probes={data.search.probes}
          originIndex={data.search.originIndex}
          originProven={data.search.originProven}
          reads={data.search.reads}
          span={data.search.span}
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
      {metrics && <EngineReceipt metrics={metrics} />}
      <ProvenanceFooter meta={data.meta} />
    </article>
  );
}
