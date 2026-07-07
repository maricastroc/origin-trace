export function CoverageBar({
  sourced,
  noteOnly,
  unsourced,
}: {
  sourced: number;
  noteOnly: number;
  unsourced: number;
}) {
  const total = Math.max(1, sourced + noteOnly + unsourced);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-line"
      role="img"
      aria-label={`${sourced} sourced, ${noteOnly} note-only, ${unsourced} uncited`}
    >
      <div className="h-full bg-success" style={{ width: seg(sourced) }} />
      <div className="h-full bg-warn" style={{ width: seg(noteOnly) }} />
      <div className="h-full bg-danger/80" style={{ width: seg(unsourced) }} />
    </div>
  );
}
