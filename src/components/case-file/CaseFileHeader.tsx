import type { ClaimProvenance } from "@/types/ClaimProvenance";

export function CaseFileHeader({ claim }: Pick<ClaimProvenance, "claim">) {
  return (
    <header>
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
    </header>
  );
}
