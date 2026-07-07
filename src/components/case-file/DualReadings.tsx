import type { VerdictReading } from "@/types/VerdictReading";
import { verdictStyle } from "@/lib/verdictStyle";

export function DualReadings({ readings }: { readings: VerdictReading[] }) {
  return (
    <section>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
        Two readings — the product won&rsquo;t choose for you
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {readings.map((reading) => {
          const style = verdictStyle[reading.verdict];
          return (
            <div
              key={reading.lens}
              className="rounded-xl border border-line-strong bg-surface-2 p-4"
            >
              <p className="text-[12px] text-ink-muted">
                Read{" "}
                <span className="font-medium text-ink">{reading.lens}</span>
              </p>
              <span
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] ${style.border}/45 ${style.tint} ${style.ink}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                  aria-hidden="true"
                />
                {style.label}
              </span>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
                {reading.reason}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
