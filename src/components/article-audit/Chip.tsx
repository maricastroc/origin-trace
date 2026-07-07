export function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "danger";
}) {
  const c =
    tone === "ok"
      ? "border-success/40 text-success"
      : tone === "warn"
        ? "border-warn/40 text-warn"
        : tone === "danger"
          ? "border-danger/40 text-danger"
          : "border-line-strong text-ink-muted";
  return (
    <span
      className={`rounded-full border bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] ${c}`}
    >
      {children}
    </span>
  );
}
