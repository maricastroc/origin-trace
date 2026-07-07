export function StatusCard({
  title,
  pulse = false,
  children,
}: {
  title: string;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 px-5 py-6 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent ${pulse ? "animate-pulse" : ""}`}
        />
        <p className="font-mono text-[13px] text-ink">{title}</p>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
        {children}
      </p>
    </div>
  );
}
