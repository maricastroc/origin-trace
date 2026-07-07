export function ScopeBanner({ scope }: { scope: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-1/50 px-4 py-2.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
        aria-hidden="true"
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        <span className="text-ink-muted">scope</span> ·{" "}
        <span className="text-ink">{scope}</span>
      </p>
    </div>
  );
}
