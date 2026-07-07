import type { ClaimProvenance } from "@/types/ClaimProvenance";

type Corpus = NonNullable<ClaimProvenance["meta"]["corpus"]>;

/**
 * The closed-corpus receipt — the quiet proof that makes the verdict weigh more
 * than a spinner's flash. Not "I searched and found X," but "the whole history
 * is this big; because the corpus is closed, the origin is a proof of absence
 * below it, not a sample."
 *
 * Live engine traces carry a binary-search read count; hand traces don't, so
 * they show the corpus size and say plainly that they were traced by hand.
 */
export function CorpusReceipt({
  corpus,
  manual,
}: {
  corpus: Corpus;
  manual: boolean;
}) {
  const { read, total, truncated } = corpus;
  const engine = typeof read === "number";

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="kicker">the corpus</p>
          <div className="mt-2.5 flex items-end gap-7">
            <Stat value={total.toLocaleString()} unit="revisions in history" />
            {engine && (
              <>
                <span
                  className="mb-1.5 font-mono text-[15px] text-line-strong"
                  aria-hidden="true"
                >
                  →
                </span>
                <Stat value={read.toLocaleString()} unit="read · binary search" />
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
          ) : (
            <Tag tone="ok">closure proven</Tag>
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
            this trace — binary search pinned the origin from the{" "}
            {read!.toLocaleString()} revisions it read, but earlier occurrences
            can&rsquo;t be ruled out.
          </>
        ) : (
          <>
            The full history is finite and enumerable. Binary search pinned the
            origin by reading {read!.toLocaleString()} of{" "}
            {total.toLocaleString()} revisions — and because the corpus is
            closed, everything below the origin is provably absent, not
            unsampled.
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
      <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
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
