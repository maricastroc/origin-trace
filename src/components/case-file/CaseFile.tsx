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
    <article className="flex flex-col gap-5">
      <CaseFileHeader claim={data.claim} verdict={data.verdict} />
      <Timeline
        events={data.timeline}
        label={
          isAmbiguous ? "Cadeia de reformulação" : "Linha do tempo da credibilidade"
        }
        subtitle={
          isAmbiguous
            ? "a protagonista — como a redação e a evidência mudaram; entre elas, o tipo de mudança"
            : "o protagonista — cada nó é uma revisão auditável; entre eles, o que mudou"
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
