import type { VerdictReading } from "@/types/VerdictReading";
import { verdictStyle } from "@/lib/verdictStyle";

export function DualReadings({ readings }: { readings: VerdictReading[] }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[13px] font-medium text-ink">
        Duas leituras — o produto não escolhe por você
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {readings.map((reading) => {
          const style = verdictStyle[reading.verdict];
          return (
            <div
              key={reading.lens}
              className="rounded-xl border border-line px-3.5 py-3"
            >
              <p className="mb-1.5 text-xs text-ink-muted">
                Vista <span className="font-medium text-ink">{reading.lens}</span>
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${style.chip}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                  aria-hidden="true"
                />
                {style.label}
              </span>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                {reading.reason}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
