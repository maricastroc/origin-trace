import { ArrowRight } from "lucide-react";
import type { ClaimProvenance } from "@/types/ClaimProvenance";

type Corpus = NonNullable<ClaimProvenance["meta"]["corpus"]>;

export function CorpusReceipt({
  corpus,
  manual,
}: {
  corpus: Corpus;
  manual: boolean;
}) {
  const { read, total, truncated, originProven } = corpus;

  const engine = typeof read === "number";

  // Closure (we listed every revision) is proven when the history wasn't
  // truncated. Origin-earliest (this is the *first* occurrence) is a separate,
  // stronger claim — proven only when the search read every revision below the
  // origin. Sampling leaves that unproven, and the copy must not conflate them.
  const proven = originProven === true;

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="kicker">the corpus</p>
          <div className="mt-2.5 flex items-end gap-7">
            <Stat value={total.toLocaleString()} unit="revisions in history" />
            {engine && (
              <>
                <ArrowRight
                  className="mb-2 h-4 w-4 text-line-strong"
                  aria-hidden="true"
                />
                <Stat
                  value={read.toLocaleString()}
                  unit="read · sample-and-bisect"
                />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Tag>closed corpus</Tag>
          {manual ? (
            <Tag>traced by hand</Tag>
          ) : truncated ? (
            <Tag tone="warn">history truncated</Tag>
          ) : proven ? (
            <Tag tone="ok">origin proven</Tag>
          ) : (
            <Tag tone="warn">earliest not proven</Tag>
          )}
        </div>
      </div>

      <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {manual ? (
          <>
            Wikipedia&rsquo;s revision history is finite and enumerable — a
            closed corpus. This case was traced by hand across it, down to the
            revisions pinned below.
          </>
        ) : truncated ? (
          <>
            The history ran past the page cap, so closure isn&rsquo;t proven for
            this trace — the search pinned the origin from the{" "}
            {read!.toLocaleString()} revisions it read, but earlier occurrences
            can&rsquo;t be ruled out.
          </>
        ) : proven ? (
          <>
            The full history is finite and enumerable, and the search read every
            revision below the origin ({read!.toLocaleString()} of{" "}
            {total.toLocaleString()} in all) — so this is the proven first
            occurrence: everything earlier is confirmed absent, not merely
            unsampled.
          </>
        ) : (
          <>
            All {total.toLocaleString()} revisions were enumerated, but the
            search read only {read!.toLocaleString()} of them — sampling the
            range below the origin rather than reading it exhaustively. So the
            origin shown is a confirmed occurrence, with its immediate
            predecessor absent, yet a sparse earlier occurrence in an unread gap
            can&rsquo;t be ruled out.
          </>
        )}
      </p>
    </section>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-display text-[30px] leading-none text-ink">
        {value}
      </span>
      <span className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        {unit}
      </span>
    </span>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn";
}) {
  const c =
    tone === "ok"
      ? "border-success/40 text-success"
      : tone === "warn"
        ? "border-warn/40 text-warn"
        : "border-line-strong text-ink-muted";
  return (
    <span
      className={`rounded-full border bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] ${c}`}
    >
      {children}
    </span>
  );
}
