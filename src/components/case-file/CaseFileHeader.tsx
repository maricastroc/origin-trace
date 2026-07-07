import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { VerdictStamp } from "./VerdictStamp";

export function CaseFileHeader({
  claim,
  verdict,
}: Pick<ClaimProvenance, "claim" | "verdict">) {
  return (
    <header className="flex items-start justify-between gap-5 sm:gap-8">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          <span className="text-accent">case file</span> · {claim.article}
          {claim.articleUrl && (
            <>
              {"  ·  "}
              <a
                href={claim.articleUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
              >
                {claim.lang ?? "en"}.wikipedia ↗
              </a>
            </>
          )}
        </p>
        <p className="mt-3 font-voice text-[22px] italic leading-snug text-ink sm:text-[26px]">
          &ldquo;{claim.text}&rdquo;
        </p>
      </div>
      <div className="shrink-0 pt-1">
        <VerdictStamp
          verdict={verdict.primary}
          confidence={verdict.confidence}
        />
      </div>
    </header>
  );
}
