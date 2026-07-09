export function SegBar({
  sourced,
  noteOnly,
  unsourced,
  className = "h-2",
}: {
  sourced: number;
  noteOnly: number;
  unsourced: number;
  className?: string;
}) {
  const total = Math.max(1, sourced + noteOnly + unsourced);

  const seg = (n: number) => `${(n / total) * 100}%`;

  return (
    <div
      className={`flex shrink-0 overflow-hidden rounded-full bg-line ${className}`}
      role="img"
      aria-label={`${sourced} sourced, ${noteOnly} note-only, ${unsourced} uncited`}
    >
      <div className="h-full bg-success" style={{ width: seg(sourced) }} />
      <div className="h-full bg-warn" style={{ width: seg(noteOnly) }} />
      {/* Uncited reads as a neutral, unfilled tan — descriptive coverage gap, not an error. */}
      <div className="h-full bg-line-strong" style={{ width: seg(unsourced) }} />
    </div>
  );
}
